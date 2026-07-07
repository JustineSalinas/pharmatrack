import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { triggerWeeklyReport } from '../weeklyReport'

const mockGetSession = vi.fn()
const mockFetch = vi.fn()

vi.mock('../supabase', () => ({
  supabase: { auth: { getSession: () => mockGetSession() } },
}))

describe('triggerWeeklyReport', () => {
  beforeEach(() => {
    mockGetSession.mockReset().mockResolvedValue({
      data: { session: { access_token: 'tok-123', expires_at: Math.floor(Date.now() / 1000) + 3600 } },
    })
    mockFetch.mockReset().mockResolvedValue({ ok: true, json: async () => ({ success: true, sent: 2 }) })
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts to the weekly-report route with a bearer token', async () => {
    const result = await triggerWeeklyReport()

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/weekly-report',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      })
    )
    expect(result).toEqual({ success: true, sent: 2 })
  })

  it('returns null instead of throwing when the fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network down'))
    const result = await triggerWeeklyReport()
    expect(result).toBeNull()
  })
})
