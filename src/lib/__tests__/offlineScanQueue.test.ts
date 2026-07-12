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

  it("treats other 4xx as unmatched — permanent rejection needing manual handling", () => {
    expect(classifySyncResult(400)).toBe("unmatched"); // window closed / not approved
    expect(classifySyncResult(403)).toBe("unmatched"); // forbidden
    expect(classifySyncResult(404)).toBe("unmatched"); // unknown QR
  });
});
