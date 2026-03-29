export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key);
};

export async function POST(req: NextRequest) {
  const supabase = getSupabase();

  // ── Auth: require logged-in admin / facilitator ──────────
  const cookieStore = await cookies();
  const token = cookieStore.get("pharmatrack_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: scanner } = await supabase
    .from("users")
    .select("account_type, status")
    .eq("id", user.id)
    .single();

  if (!scanner || !["admin", "facilitator"].includes(scanner.account_type) || scanner.status !== "approved") {
    return NextResponse.json({ error: "Only approved admins/facilitator can scan" }, { status: 403 });
  }

  // ── Parse body ───────────────────────────────────────────
  let body: { qr_code_id?: string; event_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { qr_code_id, event_id } = body;
  if (!qr_code_id || !event_id) {
    return NextResponse.json({ error: "qr_code_id and event_id are required" }, { status: 400 });
  }

  // ── Resolve student from QR code ────────────────────────
  const { data: studentProfile, error: spErr } = await supabase
    .from("student_profiles")
    .select("user_id")
    .eq("qr_code_id", qr_code_id)
    .single();

  if (spErr || !studentProfile) {
    return NextResponse.json({ error: "Student not found for this QR code" }, { status: 404 });
  }

  const studentId = studentProfile.user_id;

  // ── Fetch event & validate time window ──────────────────
  const { data: event, error: evErr } = await supabase
    .from("events")
    .select("*")
    .eq("id", event_id)
    .single();

  if (evErr || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const now = new Date();
  const checkInStart = new Date(event.check_in_start);
  const checkInEnd = new Date(event.check_in_end);
  const checkInLate = new Date(event.check_in_late);
  const checkOutStart = event.check_out_start ? new Date(event.check_out_start) : null;
  const checkOutEnd = event.check_out_end ? new Date(event.check_out_end) : null;

  // Prevent scanning before the event has started
  if (now < checkInStart) {
    return NextResponse.json(
      { error: "Event has not started yet. Check-in opens at " + checkInStart.toISOString() },
      { status: 400 },
    );
  }

  // ── Check existing attendance record ────────────────────
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", studentId)
    .eq("event_id", event_id)
    .single();

  // ────────────────────────────────────────────────────────
  // CASE 1: No record yet → Time In (first scan)
  // ────────────────────────────────────────────────────────
  if (!existing) {
    if (now > checkInEnd) {
      return NextResponse.json({ error: "Check-in window has closed" }, { status: 400 });
    }

    const status = now <= checkInLate ? "present" : "late";

    const { data: record, error: insertErr } = await supabase
      .from("attendance_records")
      .insert({
        student_id: studentId,
        event_id,
        status,
        time_in: now.toISOString(),
        scanned_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      action: "time_in",
      status,
      record,
      message: `Checked in as ${status}`,
    });
  }

  // ────────────────────────────────────────────────────────
  // CASE 2: Record exists with time_in but no time_out →
  //         Second scan = Time Out (within 4 hours)
  // ────────────────────────────────────────────────────────
  if (existing.time_in && !existing.time_out) {
    const timeIn = new Date(existing.time_in);
    const hoursSinceIn = (now.getTime() - timeIn.getTime()) / (1000 * 60 * 60);

    if (hoursSinceIn > 4) {
      return NextResponse.json(
        { error: "Time-out window expired (more than 4 hours since check-in)" },
        { status: 400 },
      );
    }

    // If event defines a check-out window, enforce it
    if (checkOutStart && now < checkOutStart) {
      return NextResponse.json(
        { error: "Check-out window has not opened yet" },
        { status: 400 },
      );
    }
    if (checkOutEnd && now > checkOutEnd) {
      return NextResponse.json(
        { error: "Check-out window has closed" },
        { status: 400 },
      );
    }

    const { data: record, error: updateErr } = await supabase
      .from("attendance_records")
      .update({ time_out: now.toISOString() })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      action: "time_out",
      status: existing.status,
      record,
      message: "Checked out successfully",
    });
  }

  // ────────────────────────────────────────────────────────
  // CASE 3: Already has both time_in and time_out
  // ────────────────────────────────────────────────────────
  return NextResponse.json(
    { error: "Student has already checked in and out for this event" },
    { status: 409 },
  );
}
