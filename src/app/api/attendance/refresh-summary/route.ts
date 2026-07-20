import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Throttled, shared refresh of the student_attendance_summary_mat materialized
// view. Reuses the same cross-device gate idea as /api/backfill/claim: staff
// pages that read the summary call this on mount (fire-and-forget); it refreshes
// at most once per REFRESH_INTERVAL_MS globally, so 500+ clients don't each
// trigger a REFRESH. Service-role client → RLS-exempt and can call the
// SECURITY DEFINER refresh function + stamp system_config.

const getAdminClient = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );

const REFRESH_INTERVAL_MS = 3 * 60_000; // 3 minutes — matview is one row/student (cheap), so keep the dashboard rate close to live during events
const CONFIG_KEY = "summaryRefreshLastRun";

export async function POST(req: NextRequest) {
  try {
    // Council-only (facilitator/admin). Students never drive refreshes.
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

    // Shared throttle.
    const now = Date.now();
    const { data: row } = await admin
      .from("system_config")
      .select("value")
      .eq("key", CONFIG_KEY)
      .maybeSingle();
    const lastRun = Number(row?.value ?? "0");
    if (Number.isFinite(lastRun) && now - lastRun < REFRESH_INTERVAL_MS) {
      return NextResponse.json({ refreshed: false });
    }

    // Stamp first so concurrent callers bail (small race is harmless — worst
    // case is one extra REFRESH).
    await admin
      .from("system_config")
      .upsert({ key: CONFIG_KEY, value: String(now), updated_at: new Date().toISOString() });

    const { error: rpcErr } = await admin.rpc("refresh_attendance_summary");
    if (rpcErr) {
      return NextResponse.json({ refreshed: false, error: rpcErr.message }, { status: 500 });
    }
    return NextResponse.json({ refreshed: true });
  } catch (err: any) {
    return NextResponse.json({ refreshed: false, error: err?.message ?? "refresh failed" }, { status: 500 });
  }
}
