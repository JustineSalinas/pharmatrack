# Plan: Disk IO Reduction + Attendance Incident Recurrence Prevention

## Context

Two interlinked problems:

1. **Disk IO depletion.** Supabase Nano is hitting its budget again despite PR #13 fixes (2026-07-09). Root cause: five unfiltered realtime subscriptions each fire a round of DB queries on every scan during active events, compounded by a matview refresh that runs every 5 minutes (not 15 as PR #13 intended) and a backfill that generates WAL bursts hourly.

2. **Attendance incident recurrence.** The 2026-07-13 incident's code fixes are all in place (target_year_levels scoping, 1-hour settle margin, DO-NOTHING inserts, scan API Case 1b absent→present conversion, no incomplete without checkout window). The one deferred item that still bites: when "All Events" is selected, the stat tiles (Present / Late / Absent) are computed from a 1000-row PostgREST-capped array. A future backfill burst of >1000 absent rows would again push real `present` records out of the array window, making the tiles show wrong numbers — the exact symptom that alarmed staff on 07-13.

---

## What the 2026-07-13 incident fixes already protect

| Risk | Guard already in code |
|---|---|
| Backfill marks wrong year level absent | `target_year_levels` scoping (`attendance.ts`) |
| Backfill fires before event window closes | 1-hour `ABSENT_SETTLE_MS` settle margin |
| Backfill overwrites a real `present` scan | Binary-split DO-NOTHING insert (23505 guard) |
| Pre-created absent row blocks scanning | Scan API Case 1b: absent+null_time_in → check-in |
| Attendees flipped to `incomplete` with no checkout window | `hasCheckoutWindow` guard in backfill |

These are solid. The fixes below sit on top of them.

---

## Fixes

### Fix 1 — Matview refresh interval: 5 min → 15 min
**File:** `src/app/api/attendance/refresh-summary/route.ts:20`

```ts
// change:
const REFRESH_INTERVAL_MS = 5 * 60_000;
// to:
const REFRESH_INTERVAL_MS = 15 * 60_000;
```

**What it does:** `REFRESH MATERIALIZED VIEW student_attendance_summary_mat` is a full sequential scan of `attendance_records`. At 5 min it runs up to 12×/hour while any council dashboard is open. The facilitator students page also calls `triggerSummaryRefresh()` on every realtime-triggered reload, which further compounds this. 15 min = 4×/hour — still fresh enough for any dashboard.

**Impact:** Immediate reduction in read IO. The smallest change with meaningful effect.

---

### Fix 2 — Raise backfill interval: 1h → 2h
**Files:** `src/app/dashboard/admin/page.tsx:60`, `src/app/dashboard/facilitator/page.tsx:45`

```ts
// change both callers from:
runIfDue("absentBackfill", 60 * 60_000, backfillEventStatusesShared)
// to:
runIfDue("absentBackfill", 2 * 60 * 60_000, backfillEventStatusesShared)
```

**What it does:** The backfill is the largest WAL write source — it inserts N×students absent rows in batches, one INSERT per batch. A 60-day window with 200 students and 10 events can insert 2000 rows in one burst. Halving the frequency halves the WAL write rate from this path. The 1-hour `ABSENT_SETTLE_MS` settle margin is unchanged and independent.

**Impact:** Halves absent-row WAL writes. Also adds more breathing room between a freshly-created event and a potential premature absent-mark (the settle margin is the primary guard, but less frequent runs = less exposure).

---

### Fix 3 — Cap facilitator students today-attendance fetch
**File:** `src/app/dashboard/facilitator/students/page.tsx:90`

```ts
// change:
.lte("created_at", todayEnd.toISOString());
// to:
.lte("created_at", todayEnd.toISOString())
.limit(5000);
```

**What it does:** This query has no `.limit()`. On a busy event day it becomes an unbounded read fired on every scan via the `student-management-rt` realtime subscription. `.limit(5000)` is a circuit breaker — well above realistic daily volume but stops an unexpected data shape from becoming an unbounded table scan.

**Impact:** Prevents an edge case from becoming a disk IO spike.

---

### Fix 4 — Replace unfiltered realtime subscriptions with polling on attendance log pages
**Files:**
- `src/app/dashboard/admin/attendance/page.tsx` (subscription at line 369)
- `src/app/dashboard/facilitator/attendance/page.tsx` (subscription at line 291)
- `src/app/dashboard/facilitator/students/page.tsx` (subscription at line 141)

**What it does:** These three pages subscribe to `{ event: "*", schema: "public", table: "attendance_records" }` with no filter. Every scan during an active event triggers all three. The two attendance pages each fire a 1000-row × 5-table JOIN (`attendance_records` + `events` + `qr_sessions` + `users` + `student_profiles`). During a 200-student scan-in with both attendance pages open: up to 400 fat JOIN reads in 30 minutes.

Replace each `postgres_changes` subscription with a `setInterval` poll:
- Attendance log pages: poll every **30 seconds**
- Students page: poll every **60 seconds** (less time-critical)
- Gate each interval on `document.visibilityState === "visible"` — don't poll hidden tabs
- Clear on unmount as usual
- Keep the manual Refresh button (it already exists on both pages)

The scanner pages (`admin/scanner`, `facilitator/scanner`) already use event-scoped filters and must NOT be changed.

**Impact:** This is the single largest disk IO reduction. Caps the attendance log read pressure at 2 queries/min per page instead of 1 query per scan. During a busy 200-student event: from ~200 fat JOIN reads down to ~4 per page.

**Implementation pattern for each page:**
```ts
// Remove the postgres_changes subscription block entirely.
// Replace with:
useEffect(() => {
  if (!currentUser) return;
  const poll = () => {
    if (document.visibilityState === "visible") fetchAttendance(true);
  };
  const id = setInterval(poll, 30_000);
  const onVisible = () => { if (document.visibilityState === "visible") fetchAttendance(true); };
  document.addEventListener("visibilitychange", onVisible);
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
}, [fetchAttendance, currentUser]);
```

---

### Fix 5 — Attendance log stat tiles: exact counts for "All Events" view
**Files:**
- `src/app/dashboard/admin/attendance/page.tsx`
- `src/app/dashboard/facilitator/attendance/page.tsx`

**What it does:** When `filterEvent === "All"`, the Present / Late / Absent stat tiles are computed from `filtered.length` which is derived from `records` — the PostgREST-capped 1000-row array. In the 2026-07-13 incident, a burst of 1953 absent rows filled that window and pushed real `present` records out of it, making the "Present" tile show 1 instead of 62.

The fix: fetch exact status counts via three parallel `head: true` queries on mount and after each `fetchAttendance`. Use these counts to drive the stat tiles when no event, section, or search filter is active. For filtered views, keep the existing array-based calculation (those typically use `eventScopedRows` anyway, which is complete).

```ts
// New state alongside existing ones:
const [globalCounts, setGlobalCounts] = useState({ present: 0, late: 0, absent: 0 });

// New function called on mount and after fetchAttendance:
const fetchGlobalCounts = useCallback(async () => {
  const [{ count: p }, { count: l }, { count: a }] = await Promise.all([
    supabase.from("attendance_records").select("*", { count: "exact", head: true }).eq("status", "present"),
    supabase.from("attendance_records").select("*", { count: "exact", head: true }).eq("status", "late"),
    supabase.from("attendance_records").select("*", { count: "exact", head: true }).eq("status", "absent"),
  ]);
  setGlobalCounts({ present: p ?? 0, late: l ?? 0, absent: a ?? 0 });
}, []);

// In the stat tile render — use globalCounts when showing unfiltered view:
const useGlobalCounts = filterEvent === "All" && filterSection === "All" && !searchQuery && !selectedDate;
const presentCount = useGlobalCounts ? globalCounts.present : present;
const lateCount    = useGlobalCounts ? globalCounts.late    : late;
const absentCount  = useGlobalCounts ? globalCounts.absent  : absent;
```

The three `head: true` queries transfer zero rows and are unaffected by PostgREST's row cap.

**Impact:** Eliminates the "1 present" symptom for all future backfill bursts. Even if a 5000-row absent burst pushes every real scan out of the 1000-row display window, the stat tiles remain accurate. This directly addresses the most alarming staff-facing symptom from the 2026-07-13 incident.

---

## What this does NOT change

- Scanner pages' filtered realtime subscriptions (`event_id=eq.${selectedEventId}`) — these are correct and stay
- The backfill's actual absent-marking logic — already correct (scoped by year, settle margin, DO-NOTHING)
- The scan API's Case 1b absent→present conversion — already in place
- The attendance log table rows — still show "most recent 1000" in "All Events" view, which is acceptable as a log feed (the stat tiles are now decoupled from this)
- Any SQL schema changes — all five fixes are application code only

---

## Verification

1. **Fix 1:** Confirm `REFRESH_INTERVAL_MS` is 15 min in the file. Open a council dashboard, wait 5 min, check Supabase dashboard — no matview refresh should trigger.
2. **Fix 2:** Confirm callers pass `2 * 60 * 60_000`. Clear `localStorage` key `pt:backfill:absentBackfill`, open admin dashboard, verify one backfill run fires. Wait 1h — should NOT fire again.
3. **Fix 3:** Read `students/page.tsx`, confirm `.limit(5000)` present on the `created_at` date-range query.
4. **Fix 4:** Open admin attendance page, open browser devtools → Network. Run a manual scan. Confirm NO new request fires within 30s (next poll fires at ~30s). Confirm the Refresh button still triggers immediately.
5. **Fix 5:** Open admin attendance page with "All Events" selected. Manually insert 1000 absent rows for a past event via SQL editor. Confirm the "Present" tile stays accurate (matches actual present count, not 0 or 1).
