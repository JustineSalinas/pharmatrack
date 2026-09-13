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

// A select result can be static, or a function of the requested .range() —
// the latter lets a test simulate PostgREST's hard 1,000-row page ceiling.
type SelectResult = { data: unknown; error: unknown }
type SelectResolver = SelectResult | ((range: { from: number; to: number } | null) => SelectResult)
const selectResults: Record<string, SelectResolver> = {}
const writeResults: Record<string, WriteResolver> = {}
const rpcResults: Record<string, WriteResolver> = {}

function setSelect(table: string, value: SelectResolver) {
  selectResults[table] = value
}
function setWrite(table: string, value: WriteResolver) {
  writeResults[table] = value
}
// insert_absent_records_batch (the RPC insertAbsentBatch calls) defaults to
// echoing back the rows it was asked to insert, as `data` — i.e. "everything
// inserted cleanly, nothing conflicted" — so tests that don't care about
// conflict behavior don't need to configure this explicitly.
function setRpc(fn: string, value: WriteResolver) {
  rpcResults[fn] = value
}
function rpcDefault(fn: string, params: unknown): { data: unknown; error: unknown } {
  if (fn === 'insert_absent_records_batch') {
    return { data: (params as { p_rows: unknown[] }).p_rows, error: null }
  }
  return { data: null, error: null }
}
function clearMockTables() {
  for (const k of Object.keys(selectResults)) delete selectResults[k]
  for (const k of Object.keys(writeResults)) delete writeResults[k]
  for (const k of Object.keys(rpcResults)) delete rpcResults[k]
}

const mockGetSession = vi.fn()
const mockFetch = vi.fn()

// Spreads the real module so fetchAllRows stays the genuine implementation —
// the paging logic is what these tests need to exercise — and overrides only
// the Supabase client with the chain mock below.
vi.mock('../supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../supabase')>();
  function buildChain(table: string) {
    let mode: 'select' | 'write' = 'select'
    let lastRows: unknown = null
    let lastRange: { from: number; to: number } | null = null
    const chain: Record<string, unknown> = {}
    chain.select = () => { mode = 'select'; return chain }
    chain.eq = () => chain
    chain.lt = () => chain
    chain.gte = () => chain
    chain.in = () => chain
    chain.limit = () => chain
    chain.order = () => chain
    // Pagination-aware: a select result may be a function of the requested
    // range, so a test can simulate PostgREST's hard 1,000-row page ceiling.
    chain.range = (from: number, to: number) => { lastRange = { from, to }; return chain }
    chain.insert = (rows: unknown) => { mode = 'write'; lastRows = rows; return chain }
    chain.update = (vals: unknown) => { mode = 'write'; lastRows = vals; return chain }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      let value: { data: unknown; error: unknown }
      if (mode === 'select') {
        const sr = selectResults[table]
        value = typeof sr === 'function' ? sr(lastRange) : (sr ?? { data: null, error: null })
      } else {
        const wr = writeResults[table]
        value = typeof wr === 'function' ? wr(lastRows) : (wr ?? { data: null, error: null })
      }
      return Promise.resolve(value).then(resolve, reject)
    }
    return chain
  }
  return {
    ...actual,
    supabase: {
      from: (table: string) => buildChain(table),
      auth: { getSession: () => mockGetSession() },
      rpc: (fn: string, params: unknown) => {
        const r = rpcResults[fn]
        const value = typeof r === 'function' ? (r as (p: unknown) => WriteResult)(params) : (r ?? rpcDefault(fn, params))
        return Promise.resolve(value)
      },
    },
  }
})

import { runIfDue, backfillEventStatuses, notifyAbsences, isEventEnded, isEventOpenNow, sortEventsForPicker, pickDefaultEvent } from '../attendance'

describe('scanner event picker — sortEventsForPicker / pickDefaultEvent', () => {
  // MMIntrams-shaped fixture: Mon..Thu, several events per day, check-in only.
  const ev = (id: string, date: string, start: string, end: string, extra: object = {}) => ({
    id, date,
    check_in_start: `${date}T${start}:00+08:00`,
    check_in_end: `${date}T${end}:00+08:00`,
    check_out_start: null, check_out_end: null, check_in_only: true,
    ...extra,
  })
  const mon = '2026-09-15', tue = '2026-09-16', thu = '2026-09-18'
  const events = [
    ev('thu-closing',   thu, '15:00', '17:00'),
    ev('tue-chess',     tue, '13:00', '16:00'),
    ev('mon-dance',     mon, '13:00', '16:00'),
    ev('mon-opening',   mon, '08:00', '10:00'),
    ev('mon-mrms',      mon, '10:30', '12:00'),
  ]

  it('puts still-open events first in chronological order, ended ones after', () => {
    // Monday 11:00 — opening has ended, Mr&Ms is live, the rest are upcoming.
    const now = new Date('2026-09-15T11:00:00+08:00')
    expect(sortEventsForPicker(events, now).map((e) => e.id)).toEqual([
      'mon-mrms', 'mon-dance', 'tue-chess', 'thu-closing', // active, chronological
      'mon-opening',                                        // ended, last
    ])
  })

  it('breaks same-day ties by check_in_start, not insertion order', () => {
    const now = new Date('2026-09-15T07:00:00+08:00') // before everything
    const ids = sortEventsForPicker(events, now).map((e) => e.id)
    expect(ids.slice(0, 3)).toEqual(['mon-opening', 'mon-mrms', 'mon-dance'])
  })

  it('preselects the event whose window is open right now over a later one', () => {
    const now = new Date('2026-09-15T11:00:00+08:00')
    expect(pickDefaultEvent(events, now)?.id).toBe('mon-mrms')
  })

  it('preselects the next upcoming event when none is open', () => {
    // Monday 12:15 — Mr&Ms closed at 12:00, dance opens at 13:00.
    const now = new Date('2026-09-15T12:15:00+08:00')
    expect(pickDefaultEvent(events, now)?.id).toBe('mon-dance')
  })

  it('does NOT preselect the latest-dated event on the first morning (the old bug)', () => {
    const now = new Date('2026-09-15T08:30:00+08:00')
    expect(pickDefaultEvent(events, now)?.id).toBe('mon-opening')
    expect(pickDefaultEvent(events, now)?.id).not.toBe('thu-closing')
  })

  it('falls back to the most recently ended event when everything is over', () => {
    const now = new Date('2026-09-19T09:00:00+08:00')
    expect(pickDefaultEvent(events, now)?.id).toBe('thu-closing')
  })

  it('returns null for an empty list', () => {
    expect(pickDefaultEvent([], new Date())).toBeNull()
  })

  it('isEventOpenNow honours a check-out window on a normal event', () => {
    const e = ev('x', mon, '08:00', '09:10', {
      check_in_only: false,
      check_out_start: `${mon}T13:00:00+08:00`,
      check_out_end: `${mon}T14:00:00+08:00`,
    })
    expect(isEventOpenNow(e, new Date('2026-09-15T08:30:00+08:00'))).toBe(true)  // check-in
    expect(isEventOpenNow(e, new Date('2026-09-15T11:00:00+08:00'))).toBe(false) // the gap
    expect(isEventOpenNow(e, new Date('2026-09-15T13:30:00+08:00'))).toBe(true)  // check-out
    expect(isEventOpenNow(e, new Date('2026-09-15T14:30:00+08:00'))).toBe(false) // after
  })
})

describe('isEventEnded', () => {
  it('is not ended before check_in_end', () => {
    const event = { check_in_end: '2026-08-28T01:10:00Z', check_out_end: '2026-08-28T06:00:00Z' }
    expect(isEventEnded(event, new Date('2026-08-28T00:30:00Z'))).toBe(false)
  })

  it('check_in_only event ends right at check_in_end, ignoring any check_out_end', () => {
    const event = { check_in_end: '2026-08-28T01:10:00Z', check_out_end: '2026-08-28T06:00:00Z', check_in_only: true }
    expect(isEventEnded(event, new Date('2026-08-28T01:10:01Z'))).toBe(true)
  })

  it('normal event with a check_out_end is not ended until check_out_end passes', () => {
    const event = { check_in_end: '2026-08-28T01:10:00Z', check_out_end: '2026-08-28T06:00:00Z' }
    expect(isEventEnded(event, new Date('2026-08-28T02:00:00Z'))).toBe(false)
    expect(isEventEnded(event, new Date('2026-08-28T06:00:01Z'))).toBe(true)
  })

  it('normal event with no check_out_end ends as soon as check_in_end passes', () => {
    const event = { check_in_end: '2026-08-28T01:10:00Z', check_out_end: null }
    expect(isEventEnded(event, new Date('2026-08-28T01:10:01Z'))).toBe(true)
  })
})

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

describe('backfillEventStatuses — optional events (counts_toward_attendance = false)', () => {
  const pastCheckInEnd = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const students = [
    { id: 's1', student_profiles: { current_year: '1st Year' } },
    { id: 's2', student_profiles: { current_year: '2nd Year' } },
    { id: 's3', student_profiles: { current_year: '3rd Year' } },
  ]

  beforeEach(() => {
    clearMockTables()
    setSelect('users', { data: students, error: null })
    setSelect('attendance_records', { data: [], error: null })
    setWrite('attendance_records', { data: null, error: null })
  })

  it('never marks anyone absent for an optional event, even with no records and a whole-school target', async () => {
    // The intramurals case: 15 sports open to everyone, students need any 5.
    // Skipping one must not become an absence.
    setSelect('events', {
      data: [{ id: 'sport-1', check_in_end: pastCheckInEnd, check_out_start: null, check_out_end: null,
               check_in_only: true, target_year_levels: null, counts_toward_attendance: false }],
      error: null,
    })
    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(0)
    expect(result.absentEntries).toEqual([])
    expect(result.eventsProcessed).toBe(1) // still visited, just no absents
  })

  it('still marks absent for a mandatory event processed in the same run', async () => {
    // Opening Ceremony (counts) and a sport (optional) closing together:
    // only the ceremony produces absents.
    setSelect('events', {
      data: [
        { id: 'opening',  check_in_end: pastCheckInEnd, check_out_start: null, check_out_end: null,
          check_in_only: true, target_year_levels: null, counts_toward_attendance: true },
        { id: 'sport-1',  check_in_end: pastCheckInEnd, check_out_start: null, check_out_end: null,
          check_in_only: true, target_year_levels: null, counts_toward_attendance: false },
      ],
      error: null,
    })
    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(3)
    expect(new Set(result.absentEntries.map((e) => e.eventId))).toEqual(new Set(['opening']))
  })

  it('treats an event row without the column (predates the migration) as counting', async () => {
    setSelect('events', {
      data: [{ id: 'legacy', check_in_end: pastCheckInEnd, check_out_start: null, check_out_end: null,
               check_in_only: false, target_year_levels: null }],
      error: null,
    })
    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(3)
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
    // scan/manual entry, or the documented double-claim backfill race).
    // insert_absent_records_batch resolves this server-side via ON CONFLICT DO
    // NOTHING within a single statement — no error, and the conflicting row is
    // simply absent from the returned (inserted) rows.
    setRpc('insert_absent_records_batch', (params) => {
      const rows = (params as { p_rows: Array<{ student_id: string; event_id: string }> }).p_rows
      const inserted = rows.filter((r) => r.student_id !== 's1')
      return { data: inserted, error: null }
    })

    const result = await backfillEventStatuses()
    expect(result.absentInserted).toBe(2) // s2 + s3 inserted; s1 skipped, not overwritten
    expect(result.absentEntries.map((e) => e.studentId).sort()).toEqual(['s2', 's3'])
    expect(result.errors).toEqual([]) // a unique violation is not surfaced as an error
  })

  it('still surfaces a genuine (non-conflict) insert error', async () => {
    setSelect('users', { data: [{ id: 's1', student_profiles: { current_year: '1st Year' } }], error: null })
    setRpc('insert_absent_records_batch', { data: null, error: { code: '42501', message: 'permission denied' } })

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
