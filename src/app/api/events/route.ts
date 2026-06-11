export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { sendEventBroadcast } from "@/lib/email";

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Supabase credentials missing");
  return createClient(url, key);
};

export async function POST(req: NextRequest) {
  console.log("[Events API] POST request received to create event");
  const supabase = getSupabase();

  // 1. Verify caller session
  const user = await getBackendUser(req);
  if (!user) {
    console.warn("[Events API] Unauthorized event creation attempt - no valid session");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Fetch caller role and status
  const { data: caller, error: callerErr } = await supabase
    .from("users")
    .select("account_type, status, email")
    .eq("id", user.id)
    .single();

  if (callerErr || !caller) {
    console.error(`[Events API] Failed to fetch profile for user ${user.id}:`, callerErr);
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isAuthorized = ["admin", "facilitator"].includes(caller.account_type) && caller.status === "approved";
  if (!isAuthorized) {
    console.warn(`[Events API] Forbidden event creation attempt by ${caller.email} (Role: ${caller.account_type}, Status: ${caller.status})`);
    return NextResponse.json({ error: "Only approved facilitators/admins can create events" }, { status: 403 });
  }

  // 3. Parse and validate payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { name, location, date, check_in_start, check_in_late, check_in_end, target_year_levels, event_type } = body;
  if (!name || !location || !date || !check_in_start || !check_in_late || !check_in_end) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // 4. Insert the new event
    const { data: newEvent, error: insertErr } = await supabase
      .from("events")
      .insert({
        name,
        location,
        date,
        check_in_start,
        check_in_late,
        check_in_end,
        created_by: user.id,
        target_year_levels: target_year_levels?.length ? target_year_levels : null,
        event_type: event_type ?? null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("[Events API] Database insert failed:", insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    console.log(`[Events API] Event successfully created: "${name}" (ID: ${newEvent.id})`);

    // 5. Query approved student emails for broadcasting — filtered by year level if event targets specific years
    const targetYears: string[] | null = target_year_levels?.length ? target_year_levels : null;

    let studentsQuery = supabase
      .from("users")
      .select("email, full_name, student_profiles!inner(current_year)")
      .eq("account_type", "student")
      .eq("status", "approved")
      .ilike("email", "%@usa.edu.ph");

    if (targetYears) {
      studentsQuery = studentsQuery.in("student_profiles.current_year", targetYears);
    }

    const { data: students, error: studentsErr } = await studentsQuery;

    if (studentsErr) {
      console.error("[Events API] Failed to fetch student recipients for broadcast:", studentsErr.message);
    } else if (students && students.length > 0) {
      await sendEventBroadcast({
        name,
        location,
        date,
        checkInStart: check_in_start,
        checkInLate: check_in_late,
        checkInEnd: check_in_end,
        eventType: event_type ?? null,
        targetYearLevels: targetYears,
        recipients: students,
      }).catch((broadcastErr) => {
        console.error("[Events API] Email broadcast failed:", broadcastErr.message);
      });
    } else {
      console.log("[Events API] No approved students found to broadcast to.");
    }

    return NextResponse.json({ success: true, event: newEvent });
  } catch (err: any) {
    console.error("[Events API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
