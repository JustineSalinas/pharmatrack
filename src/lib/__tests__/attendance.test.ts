import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock for the backfillEventStatuses suite (below) ──────────────────────────
// attendance.ts imports the browser `supabase` client directly; each `.from(table)`
// call gets its own chain instance so parallel selects/inserts/updates on the
// same table (e.g. "attendance_records" is both read and written) don't collide.
type WriteResult = { data: unknown; error: unknown }
// A write result can be a static value, or a function of the rows passed to
// insert()/update() — the latter lets a test simulate a real (partial) unique
// violation, so the conflict-tolerant absent insert can be exercised.
type WriteResolver = WriteResult | ((rows: unknown) => WriteResult)

const selectResults: Record<string, { data: unknown; error: unknown }> = {}
const writeResults: Record<string, WriteResolver> = {}

function setSelect(table: string, value: { data: unknown; error: unknown }) {
  selectResults[table] = value
}
function setWrite(table: string, value: WriteResolver) {
  writeResults[table] = value
}
function clearMockTables() {
  for (const k of Object.keys(selectResults)) delete selectResults[k]
  for (const k of Object.keys(writeResults)) delete writeResults[k]
}

const mockGetSession = vi.fn()
const mockFetch = vi.fn()

vi.mock('../supabase', () => {
  function buildChain(table: string) {
    let mode: 'select' | 'write' = 'select'
    let lastRows: unknown = null
    const chain: Record<string, unknown> = {}
    chain.select = () => { mode = 'select'; return chain }
    chain.eq = () => chain
    chain.lt = () => chain
    chain.gte = () => chain
    chain.in = () => chain
    chain.limit = () => chain
    chain.insert = (rows: unknown) => { mode = 'write'; lastRows = rows; return chain }
    chain.update = (vals: unknown) => { mode = 'write'; lastRows = vals; return chain }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let value: { data: unknown; error: unknown }
      if (mode === 'select') {
        value = selectResults[table] ?? { data: null, error: null }
      } else {
        const wr = writeResults[table]
        value = typeof wr === 'function' ? wr(lastRows) : (wr ?? { data: null, error: null })
      }
      return Promise.resolve(value).then(resolve, reject)
    }
    return chain
  }
  return {
    supabase: {
      from: (table: string) => buildChain(table),
      auth: { getSession: () => mockGetSession() },
    },
  }
})

import { runIfDue, backfillEventStatuses, notifyAbsences } from '../attendance'

describe('runIfDue', () => {
  let localStorageMock: Record<string, string> = {}

  beforeEach(() => {
    localStorageMock = {}
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => localStorageMock[key] || null,
        setItem: (key: string, value: string) => {
          localStorageMock[key] = value
        },
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should run the function if it has not been run before', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      eventsProcessed: 1,
      absentInserted: 0,
      incompleteUpdated: 0,
      errors: []
    })

    const result = await runIfDue('test-key', 5000, mockFn)
    expect(mockFn).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      eventsProcessed: 1,
      absentInserted: 0,
      incompleteUpdated: 0,
      errors: []
    })
  })

  it('should not run the function if interval has not elapsed', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      eventsProcessed: 1,
      absentInserted: 0,
      incompleteUpdated: 0,
      errors: []
    })

    // First run
    await runIfDue('test-key', 5000, mockFn)

    // Second run immediately
    const result2 = await runIfDue('test-key', 5000, mockFn)
    expect(mockFn).toHaveBeenCalledTimes(1) // still only called once
    expect(result2).toBeNull()
  })

  it('should run the function again after interval has elapsed', async () => {
    const mockFn = vi.fn().mockResolvedValue({
      eventsProcessed: 1,
      absentInserted: 0,
      incompleteUpdated: 0,
      errors: []
    })

    // First run
    await runIfDue('test-key', 5000, mockFn)

    // Simulate time passing by backdating the last run timestamp in localStorageMock
    const storageKey = 'pt:backfill:test-key'
    localStorageMock[storageKey] = String(Date.now() - 6000)

    // Second run after simulated 6 seconds
    const result2 = await runIfDue('test-key', 5000, mockFn)
    expect(mockFn).toHaveBeenCalledTimes(2)
    expect(result2).not.toBeNull()
  })

  it('should return null if window is undefined', async () => {
    vi.stubGlobal('window', undefined)
    const mockFn = vi.fn()
    const result = await runIfDue('test-key', 5000, mockFn)
    expect(result).toBeNull()
    expect(mockFn).not.toHaveBeenCalled()
  })
})

describe('backfillEventStatuses — incomplete marking', () => {
  const EVENT_ID = 'event-1'
  const STUDENT_ID = 'student-1'
  const RECORD_ID = 'record-1'
  const pastCheckInEnd = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2h ago

  beforeEach(() => {
    clearMockTables()
    setSelect('users', { data: [{ id: STUDENT_ID }], error: null })
    setWrite('attendance_records', { data: null, error: null })
  })

  it('marks incomplete when the event has an explicit check_out_end that has passed', async () => {
    const pastCheckOutEnd = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 min ago
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_end: pastCheckOutEnd, check_in_only: false }],
      error: null,
    })
    setSelect('attendance_records', {
      data: [{ id: RECORD_ID, student_id: STUDENT_ID, event_id: EVENT_ID, time_in: pastCheckInEnd, time_out: null, status: 'present' }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.incompleteUpdated).toBe(1)
    expect(result.absentInserted).toBe(0)
  })

  it('marks incomplete via the 4-hour fallback when a check-out window exists (check_out_start set) but no check_out_end', async () => {
    const timeIn5hAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_start: pastCheckInEnd, check_out_end: null, check_in_only: false }],
      error: null,
    })
    setSelect('attendance_records', {
      data: [{ id: RECORD_ID, student_id: STUDENT_ID, event_id: EVENT_ID, time_in: timeIn5hAgo, time_out: null, status: 'present' }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.incompleteUpdated).toBe(1)
  })

  it('does NOT mark incomplete for an event with no check-out window at all, even well past 4h (Issue 4)', async () => {
    const timeIn5hAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_start: null, check_out_end: null, check_in_only: false }],
      error: null,
    })
    setSelect('attendance_records', {
      data: [{ id: RECORD_ID, student_id: STUDENT_ID, event_id: EVENT_ID, time_in: timeIn5hAgo, time_out: null, status: 'present' }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.incompleteUpdated).toBe(0)
  })

  it('does not mark incomplete yet when the check_out_end deadline has not passed', async () => {
    const timeIn1hAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    const futureCheckOutEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1h from now
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_start: pastCheckInEnd, check_out_end: futureCheckOutEnd, check_in_only: false }],
      error: null,
    })
    setSelect('attendance_records', {
      data: [{ id: RECORD_ID, student_id: STUDENT_ID, event_id: EVENT_ID, time_in: timeIn1hAgo, time_out: null, status: 'present' }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.incompleteUpdated).toBe(0)
  })

  it('never marks incomplete when the event is check_in_only, even well past the 4h fallback', async () => {
    const timeIn10hAgo = new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString()
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_end: null, check_in_only: true }],
      error: null,
    })
    setSelect('attendance_records', {
      data: [{ id: RECORD_ID, student_id: STUDENT_ID, event_id: EVENT_ID, time_in: timeIn10hAgo, time_out: null, status: 'present' }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.incompleteUpdated).toBe(0)
  })
})

describe('backfillEventStatuses — absent scoping by target_year_levels (Issue 0)', () => {
  const EVENT_ID = 'event-1'
  const pastCheckInEnd = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  beforeEach(() => {
    clearMockTables()
    // No existing attendance records → every eligible student is "missing" → absent.
    setSelect('attendance_records', { data: [], error: null })
    setWrite('attendance_records', { data: null, error: null })
  })

  it('marks absent only for students in the event target year(s), not the whole school', async () => {
    setSelect('users', {
      data: [
        { id: 's1', student_profiles: { current_year: '1st Year' } },
        { id: 's2', student_profiles: { current_year: '2nd Year' } },
        { id: 's3', student_profiles: [{ current_year: '1st Year' }] }, // array (to-many) shape
        { id: 's4', student_profiles: { current_year: '4th Year' } },
      ],
      error: null,
    })
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_start: null, check_out_end: null, check_in_only: false, target_year_levels: ['1st Year'] }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(2) // s1 + s3 only
    expect(result.absentEntries.map((e) => e.studentId).sort()).toEqual(['s1', 's3'])
  })

  it('marks absent for all years when target_year_levels is null (general event)', async () => {
    setSelect('users', {
      data: [
        { id: 's1', student_profiles: { current_year: '1st Year' } },
        { id: 's2', student_profiles: { current_year: '2nd Year' } },
        { id: 's3', student_profiles: { current_year: '3rd Year' } },
      ],
      error: null,
    })
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_start: null, check_out_end: null, check_in_only: false, target_year_levels: null }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(3)
  })

  it('marks absent for all years when target_year_levels is an empty array', async () => {
    setSelect('users', {
      data: [
        { id: 's1', student_profiles: { current_year: '1st Year' } },
        { id: 's2', student_profiles: { current_year: '2nd Year' } },
      ],
      error: null,
    })
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_start: null, check_out_end: null, check_in_only: false, target_year_levels: [] }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(2)
  })
})

describe('backfillEventStatuses — premature-absent settle guard (Flaw B)', () => {
  const EVENT_ID = 'event-1'

  beforeEach(() => {
    clearMockTables()
    setSelect('users', { data: [{ id: 's1', student_profiles: { current_year: '1st Year' } }], error: null })
    setSelect('attendance_records', { data: [], error: null }) // no records → s1 is a no-show
    setWrite('attendance_records', { data: null, error: null })
  })

  it('does NOT mark absent while the check-in window closed within the settle margin', async () => {
    const justClosed = new Date(Date.now() - 60 * 1000).toISOString() // 1 min ago
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: justClosed, check_out_start: null, check_out_end: null, check_in_only: false, target_year_levels: null }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(0)
    expect(result.eventsProcessed).toBe(1) // event is still processed (for incomplete), just not absent-marked
  })

  it('marks absent once the window has been closed longer than the settle margin', async () => {
    const wellClosed = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3h ago
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: wellClosed, check_out_start: null, check_out_end: null, check_in_only: false, target_year_levels: null }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(1)
  })
})

describe('backfillEventStatuses — conflict-tolerant absent insert (DO-NOTHING semantics)', () => {
  const EVENT_ID = 'event-1'
  const wellClosed = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // past settle margin

  beforeEach(() => {
    clearMockTables()
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: wellClosed, check_out_start: null, check_out_end: null, check_in_only: false, target_year_levels: null }],
      error: null,
    })
    setSelect('attendance_records', { data: [], error: null }) // stale read: sees no existing records
  })

  it('skips an already-existing (student,event) row instead of failing the whole batch', async () => {
    setSelect('users', {
      data: [
        { id: 's1', student_profiles: { current_year: '1st Year' } },
        { id: 's2', student_profiles: { current_year: '1st Year' } },
        { id: 's3', student_profiles: { current_year: '1st Year' } },
      ],
      error: null,
    })
    // Simulate a real partial unique violation: s1 already has a row (a concurrent
    // scan/manual entry, or the documented double-claim backfill race). Any insert
    // batch containing s1 gets a 23505; batches without it succeed.
    const existing = new Set<string>(['s1|event-1'])
    setWrite('attendance_records', (rows) => {
      const arr = rows as Array<{ student_id: string; event_id: string }>
      if (arr.some((r) => existing.has(`${r.student_id}|${r.event_id}`))) {
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }
      }
      for (const r of arr) existing.add(`${r.student_id}|${r.event_id}`)
      return { data: null, error: null }
    })

    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(2) // s2 + s3 inserted; s1 skipped, not overwritten
    expect(result.absentEntries.map((e) => e.studentId).sort()).toEqual(['s2', 's3'])
    expect(result.errors).toEqual([]) // a unique violation is not surfaced as an error
  })

  it('still surfaces a genuine (non-conflict) insert error', async () => {
    setSelect('users', { data: [{ id: 's1', student_profiles: { current_year: '1st Year' } }], error: null })
    setWrite('attendance_records', { data: null, error: { code: '42501', message: 'permission denied' } })

    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(0)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('notifyAbsences', () => {
  beforeEach(() => {
    mockGetSession.mockReset().mockResolvedValue({
      data: { session: { access_token: 'tok-123', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
    })
    mockFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing when there are no entries', async () => {
    await notifyAbsences([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('posts entries with a bearer token to the notify-absences route', async () => {
    const entries = [{ studentId: 's1', eventId: 'e1' }]
    await notifyAbsences(entries)

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/notify-absences',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
        body: JSON.stringify({ entries }),
      })
    )
  })

  it('swallows fetch failures instead of throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    await expect(notifyAbsences([{ studentId: 's1', eventId: 'e1' }])).resolves.toBeUndefined()
  })
})
