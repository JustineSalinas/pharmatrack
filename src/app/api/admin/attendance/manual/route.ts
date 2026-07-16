import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { manualAttendanceSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const getAdminClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  );
};

// Manual reconciliation endpoint: lets an admin record attendance for a
// student who didn't have a PharmaTrack account (and so couldn't be QR
// scanned) at the time of a past event — e.g. a CPMT Orientation attendee
// tracked on a paper sign-in sheet before receiving their USA email.
export async function POST(req: NextRequest) {
  try {
    const caller = await getBackendUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = getAdminClient();

    const { data: callerProfile, error: profileErr } = await adminClient
      .from("users")
      .select("account_type, status, email")
      .eq("id", caller.id)
      .single();

    if (profileErr || !callerProfile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (callerProfile.account_type !== "admin" || callerProfile.status !== "approved") {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = manualAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { student_id, event_id, status, time_in, time_out, remarks } = parsed.data;

    const { data: student, error: studentErr } = await adminClient
      .from("users")
      .select("id, account_type")
      .eq("id", student_id)
      .single();
    if (studentErr || !student || student.account_type !== "student") {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const { data: event, error: eventErr } = await adminClient
      .from("events")
      .select("id, check_in_start")
      .eq("id", event_id)
      .single();
    if (eventErr || !event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // This is a reconciliation tool for events that already happened, not a
    // way to fabricate future attendance.
    if (new Date(event.check_in_start) > new Date()) {
      return NextResponse.json(
        { error: "Cannot manually record attendance for an event that hasn't started yet" },
        { status: 400 }
      );
    }

    // Insert-or-skip via RPC — uq_attendance_student_event is a PARTIAL unique
    // index (WHERE event_id IS NOT NULL) that PostgREST's .insert()/.upsert()
    // can't safely target, so a plain .insert() here would raise a real 23505
    // (logged at the DB level) on every duplicate before we could catch it.
    // insert_attendance_record_safe (schema.sql) resolves the conflict inside
    // Postgres with no error raised; an empty result means the row already
    // existed.
    const { data: rows, error: insertErr } = await adminClient.rpc("insert_attendance_record_safe", {
      p_student_id: student_id,
      p_event_id: event_id,
      p_status: status,
      p_time_in: time_in ?? null,
      p_time_out: time_out ?? null,
      p_scanned_by: caller.id,
      p_remarks:
        remarks?.trim() ||
        `Manually reconciled by ${callerProfile.email ?? "admin"} — no account at time of event`,
    });

    if (insertErr) {
      console.error("[Manual Attendance API] Insert error:", insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const record = rows?.[0] ?? null;
    if (!record) {
      return NextResponse.json(
        { error: "This student already has an attendance record for this event" },
        { status: 409 }
      );
    }

    return NextResponse.json({ record }, { status: 201 });
  } catch (err: any) {
    console.error("[Manual Attendance API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
