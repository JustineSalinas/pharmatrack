/**
 * Backfills the two attendance statuses the scanner can't set in real time:
 *
 *   • Absent     — event check-in window has closed and the student has no
 *                  attendance_record for it.
 *   • Incomplete — event has a check_out_end, that window has closed, and the
 *                  record has a time_in but no time_out.
 *
 * Designed to be safe and idempotent:
 *   - Only touches events whose check_in_end is strictly in the past.
 *   - Skips events older than `lookbackDays` (default 60) so we never backfill
 *     historical data forever.
 *   - Throttled by `runIfDue()` (call site) via localStorage.
 *
 * Returns counts so admin tooling can show "X absent, Y incomplete" feedback.
 */
import { supabase } from "./supabase";

export interface BackfillResult {
  eventsProcessed: number;
  absentInserted: number;
  incompleteUpdated: number;
  errors: string[];
}

const LOOKBACK_DAYS = 60;

export async function backfillEventStatuses(): Promise<BackfillResult> {
  const result: BackfillResult = {
    eventsProcessed: 0, absentInserted: 0, incompleteUpdated: 0, errors: [],
  };
  const nowIso = new Date().toISOString();
  const lookbackIso = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();

  // 1. Completed events within the lookback window.
  const { data: events, error: evErr } = await supabase
    .from("events")
    .select("id, check_in_end, check_out_end")
    .lt("check_in_end", nowIso)
    .gte("check_in_end", lookbackIso);
  if (evErr) { result.errors.push("events: " + evErr.message); return result; }
  if (!events || events.length === 0) return result;

  // 2. All approved students (target set for "absent" calculation).
  const { data: students, error: stuErr } = await supabase
    .from("users")
    .select("id")
    .eq("account_type", "student")
    .eq("status", "approved");
  if (stuErr) { result.errors.push("students: " + stuErr.message); return result; }
  const studentIds = (students ?? []).map((s: any) => s.id as string);
  if (studentIds.length === 0) return result;

  for (const ev of events as any[]) {
    result.eventsProcessed++;

    // 2a. Existing records for this event.
    const { data: existing, error: arErr } = await supabase
      .from("attendance_records")
      .select("id, student_id, time_in, time_out, status")
      .eq("event_id", ev.id);
    if (arErr) { result.errors.push(`event ${ev.id} fetch: ${arErr.message}`); continue; }

    const recorded = new Set((existing ?? []).map((r: any) => r.student_id as string));

    // 2b. Insert "absent" rows for any student without a record.
    const missing = studentIds.filter((sid) => !recorded.has(sid));
    if (missing.length > 0) {
      const rows = missing.map((sid) => ({
        student_id: sid,
        event_id: ev.id,
        status: "absent" as const,
        remarks: "Auto-marked: no scan recorded during the event.",
      }));
      // Insert in batches of 500 to stay well under request limits.
      for (let i = 0; i < rows.length; i += 500) {
        const slice = rows.slice(i, i + 500);
        const { error: insErr } = await supabase.from("attendance_records").insert(slice);
        if (insErr) result.errors.push(`event ${ev.id} absent insert: ${insErr.message}`);
        else result.absentInserted += slice.length;
      }
    }

    // 2c. Mark "incomplete": time_in present, time_out missing, check_out window closed.
    //     (Skip if event has no check_out_end — time_out wasn't expected.)
    if (ev.check_out_end && new Date(ev.check_out_end) < new Date(nowIso)) {
      const incompleteIds = (existing ?? [])
        .filter((r: any) => r.time_in && !r.time_out && r.status !== "incomplete" && r.status !== "absent")
        .map((r: any) => r.id as string);
      if (incompleteIds.length > 0) {
        const { error: upErr } = await supabase
          .from("attendance_records")
          .update({ status: "incomplete", remarks: "Auto-marked: time-in recorded but no time-out." })
          .in("id", incompleteIds);
        if (upErr) result.errors.push(`event ${ev.id} incomplete update: ${upErr.message}`);
        else result.incompleteUpdated += incompleteIds.length;
      }
    }
  }

  return result;
}

/**
 * Throttled wrapper — only runs the backfill if it hasn't been run for the
 * given key in the last `intervalMs`. Stored in localStorage so it's per
 * browser, which is good enough for opportunistic backfilling triggered by a
 * staff member opening their dashboard.
 */
export async function runIfDue(
  key: string,
  intervalMs: number,
  fn: () => Promise<BackfillResult>
): Promise<BackfillResult | null> {
  try {
    if (typeof window === "undefined") return null;
    const storageKey = `pt:backfill:${key}`;
    const lastRun = Number(window.localStorage.getItem(storageKey) ?? "0");
    if (Date.now() - lastRun < intervalMs) return null;
    window.localStorage.setItem(storageKey, String(Date.now()));
    return await fn();
  } catch {
    return null;
  }
}
