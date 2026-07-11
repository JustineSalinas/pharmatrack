export const dynamic = "force-dynamic";
// Broadcasting to hundreds of students over SMTP can take a while — give the
// serverless function enough runway to finish before it gets torn down.
export const maxDuration = 120;

import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getBackendUser } from "@/lib/auth";
import { sendEventBroadcast } from "@/lib/email";
import { recordEmailsSent } from "@/lib/emailUsage";

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

  const { name, location, date, check_in_start, check_in_late, check_in_end, check_out_start, check_out_end, target_year_levels, event_type, check_in_only } = body;
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
        check_out_start: check_out_start ?? null,
        check_out_end: check_out_end ?? null,
        check_in_only: check_in_only ?? false,
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

    // 5. Broadcast to approved student emails — filtered by year level if the
    // event targets specific years. Run via after() so the SMTP send (which
    // can take anywhere from instant to the full maxDuration if MailerSend is
    // slow/rate-limited/unreachable) never blocks the response the client is
    // waiting on — the event is already committed above regardless of how
    // the broadcast goes. after() keeps the function alive for this via
    // Vercel's waitUntil, within the existing maxDuration budget.
    const runBroadcast = async () => {
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
        try {
          const { sent } = await sendEventBroadcast({
            name,
            location,
            date,
            checkInStart: check_in_start,
            checkInLate: check_in_late,
            checkInEnd: check_in_end,
            eventType: event_type ?? null,
            targetYearLevels: targetYears,
            recipients: students,
          });
          await recordEmailsSent(supabase, sent);
        } catch (broadcastErr: any) {
          console.error("[Events API] Email broadcast failed:", broadcastErr.message);
        }
      } else {
        console.log("[Events API] No approved students found to broadcast to.");
      }
    };

    try {
      after(runBroadcast);
    } catch {
      // after() requires Next's request-scope, which only exists inside a
      // real next dev/Vercel request — it throws synchronously when the
      // route handler is invoked directly outside that (e.g. Vitest calling
      // POST() as a plain function). Fall back to a plain fire-and-forget
      // call so tests don't depend on after() plumbing that doesn't apply
      // to them; this branch never runs in the actual deployed app.
      void runBroadcast();
    }

    return NextResponse.json({ success: true, event: newEvent });
  } catch (err: any) {
    console.error("[Events API] Internal server error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
