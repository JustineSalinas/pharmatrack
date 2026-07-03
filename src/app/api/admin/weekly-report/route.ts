import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { getSystemConfigServer } from "@/lib/systemConfig";
import { sendWeeklyDigest } from "@/lib/email";

export const dynamic = "force-dynamic";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

// YYYY-MM-DD for "7 days ago", computed in local server time — good enough
// for a weekly cutoff (the alternative, comparing full timestamps, would
// exclude events from exactly 7 days ago depending on time-of-day).
function sevenDaysAgoDateStr(): string {
  const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getBackendUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("account_type, status")
      .eq("id", caller.id)
      .single();

    if (profileErr || !callerProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      !["admin", "facilitator"].includes(callerProfile.account_type) ||
      callerProfile.status !== "approved"
    ) {
      return NextResponse.json({ error: "Forbidden: Council only" }, { status: 403 });
    }

    const config = await getSystemConfigServer(adminClient);
    if (config.weeklyReports !== "true") {
      return NextResponse.json({ success: true, sent: 0, skipped: "weekly reports disabled" });
    }

    const { data: facilitators, error: facErr } = await adminClient
      .from("users")
      .select("id, email, full_name")
      .eq("account_type", "facilitator")
      .eq("status", "approved");
    if (facErr) throw facErr;
    if (!facilitators || facilitators.length === 0) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const { data: events, error: evErr } = await adminClient
      .from("events")
      .select("id, created_by, attendance_records(status)")
      .gte("date", sevenDaysAgoDateStr());
    if (evErr) throw evErr;

    type Agg = { events: number; present: number; late: number; absent: number; incomplete: number; total: number };
    const byFacilitator = new Map<string, Agg>();

    for (const ev of events ?? []) {
      const fid = (ev as any).created_by as string | null;
      if (!fid) continue;
      if (!byFacilitator.has(fid)) {
        byFacilitator.set(fid, { events: 0, present: 0, late: 0, absent: 0, incomplete: 0, total: 0 });
      }
      const agg = byFacilitator.get(fid)!;
      agg.events += 1;

      const records = ((ev as any).attendance_records ?? []) as Array<{ status: string }>;
      for (const r of records) {
        agg.total += 1;
        if (r.status === "present") agg.present += 1;
        else if (r.status === "late") agg.late += 1;
        else if (r.status === "absent") agg.absent += 1;
        else if (r.status === "incomplete") agg.incomplete += 1;
      }
    }

    const digests = facilitators
      .map((f: any) => {
        const agg = byFacilitator.get(f.id);
        if (!agg || agg.events === 0) return null; // nothing to report this week
        const attendanceRate = agg.total > 0 ? Math.round(((agg.present + agg.late) / agg.total) * 100) : 0;
        return {
          facilitatorName: f.full_name ?? "Facilitator",
          facilitatorEmail: f.email as string,
          eventsCount: agg.events,
          attendanceRate,
          presentCount: agg.present,
          lateCount: agg.late,
          absentCount: agg.absent,
          incompleteCount: agg.incomplete,
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null);

    await sendWeeklyDigest(digests);

    return NextResponse.json({ success: true, sent: digests.length });
  } catch (err: any) {
    console.error("[Weekly Report API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
