/**
 * Backfills the two attendance statuses the scanner can't set in real time:
 *
 *   • Absent     — event check-in window has closed and the student has no
 *                  attendance_record for it.
 *   • Incomplete — record has a time_in but no time_out, and the check-out
 *                  deadline has passed (the event's check_out_end if set,
 *                  otherwise 4 hours after that record's own time_in).
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
  /** student_id/event_id pairs newly marked absent this run — feeds notifyAbsences(). */
  absentEntries: Array<{ studentId: string; eventId: string }>;
}

const LOOKBACK_DAYS = 60;

export async function backfillEventStatuses(): Promise<BackfillResult> {
  const result: BackfillResult = {
    eventsProcessed: 0, absentInserted: 0, incompleteUpdated: 0, errors: [], absentEntries: [],
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

  // 3. Fetch ALL existing attendance records for these events in a SINGLE query!
  const eventIds = events.map((ev: any) => ev.id);
  const { data: allRecords, error: arErr } = await supabase
    .from("attendance_records")
    .select("id, student_id, event_id, time_in, time_out, status")
    .in("event_id", eventIds);
  if (arErr) { result.errors.push("attendance_records fetch: " + arErr.message); return result; }

  // 4. Group existing records by event_id for fast O(1) in-memory lookup
  const recordsByEvent = new Map<string, any[]>();
  for (const r of allRecords ?? []) {
    if (!r.event_id) continue;
    if (!recordsByEvent.has(r.event_id)) {
      recordsByEvent.set(r.event_id, []);
    }
    recordsByEvent.get(r.event_id)!.push(r);
  }

  const absentRowsToInsert: any[] = [];
  const incompleteIdsToUpdate: string[] = [];

  for (const ev of events as any[]) {
    result.eventsProcessed++;

    const existing = recordsByEvent.get(ev.id) ?? [];
    const recorded = new Set(existing.map((r: any) => r.student_id as string));

    // 2b. Collect "absent" rows for any student without a record.
    const missing = studentIds.filter((sid) => !recorded.has(sid));
    for (const sid of missing) {
      absentRowsToInsert.push({
        student_id: sid,
        event_id: ev.id,
        status: "absent" as const,
        remarks: "Auto-marked: no scan recorded during the event.",
      });
    }

    // 2c. Collect "incomplete" record IDs: time_in present, time_out missing, and the
    // check-out deadline has passed. If the event defines an explicit check_out_end,
    // use that; otherwise fall back to 4 hours after this record's own time_in —
    // mirroring the hard check-out cap the scan API itself enforces ("more than 4
    // hours since check-in") — so events with no explicit check-out window still
    // eventually get marked incomplete instead of never.
    const incomplete = existing.filter((r: any) => {
      if (!r.time_in || r.time_out || r.status === "incomplete" || r.status === "absent") return false;
      const deadline = ev.check_out_end
        ? new Date(ev.check_out_end)
        : new Date(new Date(r.time_in).getTime() + 4 * 60 * 60 * 1000);
      return deadline < new Date(nowIso);
    });
    for (const r of incomplete) {
      incompleteIdsToUpdate.push(r.id);
    }
  }

  // 5. Batch insert the absent records (using batches of 500)
  if (absentRowsToInsert.length > 0) {
    for (let i = 0; i < absentRowsToInsert.length; i += 500) {
      const slice = absentRowsToInsert.slice(i, i + 500);
      const { error: insErr } = await supabase.from("attendance_records").insert(slice);
      if (insErr) {
        result.errors.push("absent insert failed: " + insErr.message);
      } else {
        result.absentInserted += slice.length;
        result.absentEntries.push(
          ...slice.map((r) => ({ studentId: r.student_id as string, eventId: r.event_id as string }))
        );
      }
    }
  }

  // 6. Batch update the incomplete records (using batches of 500)
  if (incompleteIdsToUpdate.length > 0) {
    for (let i = 0; i < incompleteIdsToUpdate.length; i += 500) {
      const slice = incompleteIdsToUpdate.slice(i, i + 500);
      const { error: upErr } = await supabase
        .from("attendance_records")
        .update({ status: "incomplete", remarks: "Auto-marked: time-in recorded but no time-out." })
        .in("id", slice);
      if (upErr) {
        result.errors.push("incomplete update failed: " + upErr.message);
      } else {
        result.incompleteUpdated += slice.length;
      }
    }
  }

  return result;
}

/**
 * Cross-device claim for the shared backfill slot. Asks the server (which uses
 * the service-role client) whether this caller should run the job now, recording
 * the run in system_config so other staff devices skip it for the interval.
 *
 * Fails OPEN (returns true) on any error, so a route/network hiccup degrades to
 * the old per-browser behavior rather than silently skipping the backfill.
 */
export async function claimSharedRun(key: string, intervalMs: number): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const res = await fetch("/api/backfill/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ key, intervalMs }),
    });
    if (!res.ok) return true;
    const json = await res.json();
    return json?.due !== false;
  } catch {
    return true;
  }
}

/**
 * Fire-and-forget trigger for the throttled materialized-view refresh. Staff
 * pages that read student_attendance_summary call this on mount; the server
 * route dedupes to at most once per few minutes across all clients. Best-effort:
 * a failure just means the summary is a little more stale until the next call.
 */
export async function triggerSummaryRefresh(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch("/api/attendance/refresh-summary", {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    // best-effort
  }
}

const EMPTY_BACKFILL: BackfillResult = {
  eventsProcessed: 0, absentInserted: 0, incompleteUpdated: 0, errors: [], absentEntries: [],
};

/**
 * Backfill wrapped in the shared cross-device claim. The per-browser `runIfDue`
 * gate still fronts this (cheap, no network), then this dedupes across the fleet
 * of staff devices so the heavy 60-day scan runs at most once per interval
 * globally. Returns an empty result (safe for notifyAbsences) when another
 * device already claimed the slot.
 */
export async function backfillEventStatusesShared(
  intervalMs: number = 60 * 60_000
): Promise<BackfillResult> {
  const due = await claimSharedRun("absentBackfill", intervalMs);
  if (!due) return EMPTY_BACKFILL;
  const result = await backfillEventStatuses();
  // Backfill mutated attendance_records → nudge the summary matview to refresh.
  if (result.absentInserted > 0 || result.incompleteUpdated > 0) {
    void triggerSummaryRefresh();
  }
  return result;
}

/**
 * Throttled wrapper — only runs `fn` if it hasn't been run for the given key
 * in the last `intervalMs`. Stored in localStorage so it's per browser, which
 * is good enough for opportunistic work triggered by a staff member opening
 * their dashboard (the attendance backfill, and the weekly report send).
 */
export async function runIfDue<T>(
  key: string,
  intervalMs: number,
  fn: () => Promise<T>
): Promise<T | null> {
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

/**
 * Fires the server-side absence-notification send for newly-absent
 * student/event pairs from a backfill run. Deliberately just a `fetch()` to
 * an API route rather than importing `src/lib/email.ts` directly — that
 * module pulls in `nodemailer`, which can't be bundled into the client code
 * that calls `backfillEventStatuses()` (dashboard pages, the Settings page's
 * Recompute button). The route itself checks `system_config.absenceNotifications`
 * and no-ops if it's off.
 */
export async function notifyAbsences(entries: Array<{ studentId: string; eventId: string }>): Promise<void> {
  if (entries.length === 0) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    await fetch("/api/admin/notify-absences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ entries }),
    });
  } catch {
    // Best-effort — a failed notification send must never break the backfill flow.
  }
}
