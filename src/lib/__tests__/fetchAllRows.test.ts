import { describe, it, expect, vi } from "vitest";
import { fetchAllRows } from "../supabase";

/**
 * Simulates PostgREST: serves rows from a fixed table for an inclusive
 * [from, to] range, and never returns more than `ceiling` rows in one call —
 * the hard 1,000-row cap that silently truncates oversized `.limit()` calls.
 */
function fakeTable(total: number, ceiling = 1000) {
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const calls: Array<{ from: number; to: number }> = [];
  const page = (from: number, to: number) => {
    calls.push({ from, to });
    const width = Math.min(to - from + 1, ceiling);
    return Promise.resolve({ data: rows.slice(from, from + width), error: null });
  };
  return { page, calls };
}

describe("fetchAllRows", () => {
  it("returns every row when the table is larger than one page", async () => {
    const { page, calls } = fakeTable(3539);
    const { data, error, truncated } = await fetchAllRows<{ id: number }>(page);

    expect(error).toBeNull();
    expect(truncated).toBe(false);
    // The regression this helper exists for: a bare .limit(20000) returned 1000.
    expect(data).toHaveLength(3539);
    expect(data[0].id).toBe(0);
    expect(data[3538].id).toBe(3538);
    expect(new Set(data.map((r) => r.id)).size).toBe(3539); // no dupes across pages
    expect(calls.length).toBe(4); // 1000 + 1000 + 1000 + 539
  });

  it("stops after one request when the table fits in a single page", async () => {
    const { page, calls } = fakeTable(12);
    const { data } = await fetchAllRows<{ id: number }>(page);
    expect(data).toHaveLength(12);
    expect(calls).toHaveLength(1);
  });

  it("returns an empty result without a second request when the table is empty", async () => {
    const { page, calls } = fakeTable(0);
    const { data, error } = await fetchAllRows<{ id: number }>(page);
    expect(data).toEqual([]);
    expect(error).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("handles a total that is an exact multiple of the page size", async () => {
    // 2000 rows means page 3 comes back empty; the helper must handle that
    // rather than looping forever or reporting truncation.
    const { page, calls } = fakeTable(2000);
    const { data, truncated } = await fetchAllRows<{ id: number }>(page);
    expect(data).toHaveLength(2000);
    expect(truncated).toBe(false);
    expect(calls).toHaveLength(3);
  });

  it("surfaces an error and stops paging", async () => {
    const page = vi.fn()
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { data, error } = await fetchAllRows<{ id: number }>(page);
    expect(error).toEqual({ message: "boom" });
    expect(data).toHaveLength(1000); // partial rows handed back, not discarded
    expect(page).toHaveBeenCalledTimes(2); // aborted, did not keep paging
  });

  it("flags truncation instead of silently returning a short result at the ceiling", async () => {
    const { page } = fakeTable(10_000);
    const { data, truncated } = await fetchAllRows<{ id: number }>(page, { maxRows: 2000 });
    expect(data).toHaveLength(2000);
    expect(truncated).toBe(true); // the failure mode this whole helper exists to end
  });

  it("never requests a page wider than the 1,000-row server ceiling", async () => {
    const { page, calls } = fakeTable(2500);
    await fetchAllRows<{ id: number }>(page, { pageSize: 5000 });
    for (const c of calls) expect(c.to - c.from + 1).toBeLessThanOrEqual(1000);
  });

  it("does not overshoot maxRows on the final page", async () => {
    const { page, calls } = fakeTable(10_000);
    await fetchAllRows<{ id: number }>(page, { maxRows: 1500 });
    const last = calls[calls.length - 1];
    expect(last.to).toBe(1499);
  });
});
