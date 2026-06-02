import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runIfDue } from '../attendance'

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
