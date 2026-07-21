import { describe, it, expect } from "vitest";
import { classifySyncResult } from "@/lib/offlineScanQueue";

// Pure sync-routing logic — decides what happens to each queued scan when it's
// replayed against /api/scan. No IndexedDB or network needed.
describe("classifySyncResult", () => {
  it("treats 200 as synced (includes the 23505 dedup race, which returns 200)", () => {
    expect(classifySyncResult(200)).toBe("synced");
  });

  it("treats 409 as duplicate — already fully recorded / check-in-only done", () => {
    expect(classifySyncResult(409)).toBe("duplicate");
  });

  it("treats 5xx / 52x / 504 as retry (backend still unreachable)", () => {
    expect(classifySyncResult(500)).toBe("retry");
    expect(classifySyncResult(502)).toBe("retry");
    expect(classifySyncResult(503)).toBe("retry");
    expect(classifySyncResult(504)).toBe("retry");
    expect(classifySyncResult(522)).toBe("retry");
    expect(classifySyncResult(524)).toBe("retry");
  });

  // Regression: on 2026-07-21 a facilitator's session lapsed mid-event and 22
  // valid scans were written off as permanent rejections. A 401 says nothing
  // about the scan itself, so it must stay queued and be recoverable by
  // logging back in — never discarded into manual reconciliation.
  it("treats 401 as auth — recoverable, scan stays queued", () => {
    expect(classifySyncResult(401)).toBe("auth");
  });

  it("treats other 4xx as unmatched — permanent rejection needing manual handling", () => {
    expect(classifySyncResult(400)).toBe("unmatched"); // window closed / not approved
    expect(classifySyncResult(403)).toBe("unmatched"); // forbidden — a real permission problem, unlike 401
    expect(classifySyncResult(404)).toBe("unmatched"); // unknown QR
  });
});
