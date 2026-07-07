import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mock for the backfillEventStatuses suite (below) ──────────────────────────
// attendance.ts imports the browser `supabase` client directly; each `.from(table)`
// call gets its own chain instance so parallel selects/inserts/updates on the
// same table (e.g. "attendance_records" is both read and written) don't collide.
const selectResults: Record<string, { data: unknown; error: unknown }> = {}
const writeResults: Record<string, { data: unknown; error: unknown }> = {}

function setSelect(table: string, value: { data: unknown; error: unknown }) {
  selectResults[table] = value
}
function setWrite(table: string, value: { data: unknown; error: unknown }) {
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
    const chain: Record<string, unknown> = {}
    chain.select = () => { mode = 'select'; return chain }
    chain.eq = () => chain
    chain.lt = () => chain
    chain.gte = () => chain
    chain.in = () => chain
    chain.insert = () => { mode = 'write'; return chain }
    chain.update = () => { mode = 'write'; return chain }
    chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      const value = mode === 'select'
        ? (selectResults[table] ?? { data: null, error: null })
        : (writeResults[table] ?? { data: null, error: null })
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
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_end: pastCheckOutEnd }],
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

  it('marks incomplete via the 4-hour fallback when the event has no check_out_end', async () => {
    const timeIn5hAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_end: null }],
      error: null,
    })
    setSelect('attendance_records', {
      data: [{ id: RECORD_ID, student_id: STUDENT_ID, event_id: EVENT_ID, time_in: timeIn5hAgo, time_out: null, status: 'present' }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.incompleteUpdated).toBe(1)
  })

  it('does not mark incomplete yet when no check_out_end and under 4 hours have passed', async () => {
    const timeIn1hAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    setSelect('events', {
      data: [{ id: EVENT_ID, check_in_end: pastCheckInEnd, check_out_end: null }],
      error: null,
    })
    setSelect('attendance_records', {
      data: [{ id: RECORD_ID, student_id: STUDENT_ID, event_id: EVENT_ID, time_in: timeIn1hAgo, time_out: null, status: 'present' }],
      error: null,
    })

    const result = await backfillEventStatuses()
    expect(result.incompleteUpdated).toBe(0)
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
