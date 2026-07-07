export const dynamic = "force-dynamic";
// Safety margin under concurrent load during busy events — default Vercel
// timeout leaves zero configured headroom if Supabase latency spikes.
export const maxDuration = 15;

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key);
};

export async function POST(req: NextRequest) {
  console.log("[Scan API] POST request received");
  const supabase = getSupabase();

  // ── Auth: require logged-in admin / facilitator ──────────
  const user = await getBackendUser(req);
  if (!user) {
    console.warn("[Scan API] Unauthorized scan attempt - no valid session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ───────────────────────────────────────────
  let body: { qr_code_id?: string; event_id?: string };
  try {
    body = await req.json();
  } catch {
    console.error("[Scan API] Failed to parse JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { qr_code_id, event_id } = body;
  if (!qr_code_id || !event_id) {
    console.warn(`[Scan API] Missing fields in scan payload: qr_code_id=${qr_code_id}, event_id=${event_id}`);
    return NextResponse.json({ error: "qr_code_id and event_id are required" }, { status: 400 });
  }

  // ── Scanner authorization + student/event resolution (parallelized: none
  // of these three lookups depend on each other) ──────────────────────────
  const [scannerRes, studentProfileRes, eventRes] = await Promise.all([
    supabase.from("users").select("account_type, status, email").eq("id", user.id).single(),
    supabase.from("student_profiles").select("user_id").eq("qr_code_id", qr_code_id).single(),
    supabase
      .from("events")
      .select("check_in_start, check_in_late, check_in_end, check_out_start, check_out_end")
      .eq("id", event_id)
      .single(),
  ]);

  const scanner = scannerRes.data;
  if (!scanner || !["admin", "facilitator"].includes(scanner.account_type) || scanner.status !== "approved") {
    console.warn(`[Scan API] Forbidden scan attempt by user ${user.id} (${scanner?.email || "unknown email"}), Account Type: ${scanner?.account_type || "none"}, Status: ${scanner?.status || "none"}`);
    return NextResponse.json({ error: "Only approved admins/facilitators can scan" }, { status: 403 });
  }

  console.log(`[Scan API] Authorized scan request by ${scanner.email} (${scanner.account_type})`);

  const studentProfile = studentProfileRes.data;
  if (studentProfileRes.error || !studentProfile) {
    console.warn(`[Scan API] Student profile not found for QR code ${qr_code_id}`);
    return NextResponse.json({ error: "Student not found for this QR code" }, { status: 404 });
  }

  const studentId = studentProfile.user_id;
  console.log(`[Scan API] Resolved QR code ${qr_code_id} to student ${studentId}`);

  const event = eventRes.data;
  if (eventRes.error || !event) {
    console.error(`[Scan API] Event ${event_id} not found or query error:`, eventRes.error);
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Student approval check + existing attendance-record lookup, parallelized:
  // both depend only on studentId/event_id (already resolved above) and
  // don't depend on each other.
  const [{ data: studentUser }, { data: existing }] = await Promise.all([
    supabase.from("users").select("status").eq("id", studentId).single(),
    supabase.from("attendance_records").select("*").eq("student_id", studentId).eq("event_id", event_id).single(),
  ]);

  if (!studentUser || studentUser.status !== "approved") {
    console.warn(`[Scan API] Scan rejected: student account ${studentId} is not approved (status: ${studentUser?.status || 'none'})`);
    return NextResponse.json({ error: "Student account is pending approval or inactive" }, { status: 400 });
  }

  const now = new Date();
  const checkInStart = new Date(event.check_in_start);
  const checkInEnd = new Date(event.check_in_end);
  const checkInLate = new Date(event.check_in_late);
  const checkOutStart = event.check_out_start ? new Date(event.check_out_start) : null;
  const checkOutEnd = event.check_out_end ? new Date(event.check_out_end) : null;

  // Prevent scanning before the event has started
  if (now < checkInStart) {
    const localTimeStr = checkInStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const localDateStr = checkInStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    console.warn(`[Scan API] Scan attempted before event start. Event check-in opens at ${checkInStart.toISOString()}`);
    return NextResponse.json(
      { error: `Event has not started yet. Check-in opens at ${localTimeStr} on ${localDateStr}.` },
      { status: 400 },
    );
  }

  // ────────────────────────────────────────────────────────
  // CASE 1: No record yet → Time In (first scan)
  // ────────────────────────────────────────────────────────
  if (!existing) {
    if (now > checkInEnd) {
      console.warn(`[Scan API] Check-in window closed for event ${event_id}. Closed at ${checkInEnd.toISOString()}`);
      return NextResponse.json({ error: "Check-in window has closed" }, { status: 400 });
    }

    const status = now <= checkInLate ? "present" : "late";
    console.log(`[Scan API] Creating check-in for student ${studentId} with status ${status}`);

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
      // 23505 = unique_violation: a concurrent scan for the same student+event
      // won the race between our SELECT and this INSERT. Treat it as "already
      // checked in" instead of surfacing a duplicate-record error.
      if (insertErr.code === "23505") {
        const { data: raceRecord } = await supabase
          .from("attendance_records")
          .select("*")
          .eq("student_id", studentId)
          .eq("event_id", event_id)
          .single();
        console.warn(`[Scan API] Concurrent check-in race for student ${studentId}, event ${event_id} — returning existing record`);
        return NextResponse.json({
          action: "time_in",
          status: raceRecord?.status ?? status,
          record: raceRecord,
          message: `Already checked in as ${raceRecord?.status ?? status}`,
        });
      }
      console.error(`[Scan API] Error inserting check-in record for student ${studentId}:`, insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    console.log(`[Scan API] Successfully checked in student ${studentId} (Status: ${status}, Record ID: ${record.id})`);
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
      console.warn(`[Scan API] Check-out failed: Time-out window expired (hours since check-in: ${hoursSinceIn.toFixed(2)} > 4)`);
      return NextResponse.json(
        { error: "Time-out window expired (more than 4 hours since check-in)" },
        { status: 400 },
      );
    }

    // If event defines a check-out window, enforce it
    if (checkOutStart && now < checkOutStart) {
      console.warn(`[Scan API] Check-out failed: Check-out window not open. Opens at ${checkOutStart.toISOString()}`);
      return NextResponse.json(
        { error: "Check-out window has not opened yet" },
        { status: 400 },
      );
    }
    if (checkOutEnd && now > checkOutEnd) {
      console.warn(`[Scan API] Check-out failed: Check-out window closed. Closed at ${checkOutEnd.toISOString()}`);
      return NextResponse.json(
        { error: "Check-out window has closed" },
        { status: 400 },
      );
    }

    console.log(`[Scan API] Recording check-out for student ${studentId} (Record ID: ${existing.id})`);

    const { data: record, error: updateErr } = await supabase
      .from("attendance_records")
      .update({ time_out: now.toISOString() })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr) {
      console.error(`[Scan API] Error updating check-out record ${existing.id} for student ${studentId}:`, updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    console.log(`[Scan API] Successfully checked out student ${studentId} (Record ID: ${record.id})`);
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
  console.warn(`[Scan API] Student ${studentId} has already completed check-in and check-out for event ${event_id}`);
  return NextResponse.json(
    { error: "Student has already checked in and out for this event" },
    { status: 409 },
  );
}
