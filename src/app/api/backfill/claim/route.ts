import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Shared, cross-device throttle for the client-triggered attendance backfill.
//
// `runIfDue()` (src/lib/attendance.ts) only throttles per browser via
// localStorage, so every staff *device* independently runs the heavy 60-day
// scan hourly. This route records the last run in `system_config` using the
// service-role client (facilitators are council but NOT admin, so they can't
// write system_config under RLS) and hands back whether the caller should run —
// deduplicating concurrent staff devices to at most one global run per interval.

const getAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

// Only jobs listed here may claim a shared slot (they write to system_config).
const ALLOWED_KEYS = new Set(["absentBackfill"]);
const MIN_INTERVAL_MS = 60_000; // 1 minute
const MAX_INTERVAL_MS = 30 * 24 * 60 * 60_000; // 30 days

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — must be an approved council member (facilitator/admin).
    const caller = await getBackendUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = getAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("account_type, status")
      .eq("id", caller.id)
      .single();
    if (
      !profile ||
      profile.status !== "approved" ||
      !["facilitator", "admin"].includes(profile.account_type)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 2. Validate input.
    const body = await req.json().catch(() => ({}));
    const key = String(body?.key ?? "");
    const intervalMs = Number(body?.intervalMs);
    if (!ALLOWED_KEYS.has(key)) {
      return NextResponse.json({ error: "Unknown job key" }, { status: 400 });
    }
    if (
      !Number.isFinite(intervalMs) ||
      intervalMs < MIN_INTERVAL_MS ||
      intervalMs > MAX_INTERVAL_MS
    ) {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }

    const configKey = `backfillLastRun:${key}`;
    const now = Date.now();

    // 3. Read the shared last-run timestamp.
    const { data: row } = await admin
      .from("system_config")
      .select("value")
      .eq("key", configKey)
      .maybeSingle();

    const lastRun = Number(row?.value ?? "0");
    if (Number.isFinite(lastRun) && now - lastRun < intervalMs) {
      return NextResponse.json({ due: false });
    }

    // 4. Claim the slot by stamping now. (Read-then-write leaves a small race
    //    window where two devices could both claim on the same tick — harmless
    //    for an hourly job: worst case is one duplicate run.)
    await admin
      .from("system_config")
      .upsert({ key: configKey, value: String(now), updated_at: new Date().toISOString() });

    return NextResponse.json({ due: true });
  } catch (err: any) {
    // Fail open: if the claim can't be evaluated, let the caller proceed. The
    // per-device localStorage gate still caps it at once/hour/device, so a route
    // outage degrades to the old behavior rather than skipping the backfill.
    return NextResponse.json({ due: true, error: err?.message ?? "claim failed" });
  }
}
