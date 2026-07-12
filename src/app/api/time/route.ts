export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/**
 * Returns the server's current time as an ISO string. Used by the offline scan
 * queue's clock-sanity check: before syncing offline-captured scans, the client
 * compares this to its own device clock, and if they diverge beyond a small
 * threshold it warns the operator that queued scan times may be wrong (the
 * device clock is the only time source available while offline).
 */
export async function GET() {
  return NextResponse.json(
    { now: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
