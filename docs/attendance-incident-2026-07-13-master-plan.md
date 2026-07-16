# Attendance Incident — Master Diagnosis & Fix Plan (2026-07-13)

> **Status:** code fixes IMPLEMENTED on branch `fix/attendance-incident-backfill-scan-display`
> (type-check clean, 156 tests pass, build OK). The **SQL data remediations remain manual** (run
> them in the Supabase SQL editor). All findings confirmed via read-only SELECTs against the live
> Supabase DB and by reading source. **No attendance data was lost.** This document is the single
> source of truth consolidating every finding, the evidence, remediation SQL, code fixes, safety,
> and verification.
>
> ### Implementation status (code)
>
> | Item                                                                                                  | Status                                                       |
> | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
> | Issue 0 — backfill scoped to `target_year_levels`                                                     | ✅ implemented + tests (`src/lib/attendance.ts`)             |
> | Issue 0 — **premature-backfill guard** (settle margin before absent-marking, Flaw B)                  | ✅ implemented + tests (`src/lib/attendance.ts`)             |
> | Issue 0 — **conflict-tolerant absent insert** (DO-NOTHING semantics; can't overwrite a `present` row) | ✅ implemented + tests (`src/lib/attendance.ts`)             |
> | Issue 1 — scan API converts `time_in IS NULL` placeholder → check-in                                  | ✅ implemented + tests (`src/app/api/scan/route.ts`)         |
> | Issue 4 — backfill no longer marks `incomplete` without a check-out window                            | ✅ implemented + tests (`src/lib/attendance.ts`)             |
> | Issue 2 — attendance-log window cap 2,000 → 20,000 (both pages)                                       | ✅ implemented (interim; full count-based redesign deferred) |
> | Issue 3 — analytics Monthly Trend / Total Sessions off empty `qr_sessions` → event-based              | ✅ implemented (admin + facilitator reports)                 |
> | CPMT `present` restore / placeholder `DELETE` / `late`→`present`                                      | ⏳ manual SQL (below) — not code                             |
>
> **Deferred:** Issue 2's fully robust count-based stat cards / event-scoped table (needs live UI
> testing). The 20,000 cap resolves the reported "1 present" truncation for current data volume
> (2,681 rows) with headroom.
>
> ### Update — premature-backfill guard + conflict-tolerant insert landed (2026-07-13)
>
> Two further `backfillEventStatuses` hardenings shipped on this branch:
>
> - **Flaw B guard (settle margin):** no-shows are auto-marked `absent` only once an event's
>   check-in window has been closed for at least `ABSENT_SETTLE_MS` (1 hour, tunable). Stops an
>   event whose `check_in_end` is already past (placeholder times, or a window edited after the
>   fact) from having its whole roster pre-marked absent _before_ students scan. Absent-marking is
>   idempotent, so it just lands on a later run.
> - **Conflict-tolerant absent insert:** the batch insert now binary-splits and retries on a
>   `23505` unique violation, skipping only already-existing rows with true `DO NOTHING` semantics
>   — a single concurrent scan/manual entry (or the double-claim race) no longer drops up to 499
>   valid absents, and an existing `present`/`late` row can never be clobbered back to `absent`. A
>   raw `.upsert()` is not usable here: the `(student_id, event_id)` guard is a _partial_ unique
>   index (`WHERE event_id IS NOT NULL`) that PostgREST can't target, so the logic lives in app code.

---

## 0. Executive summary

Staff reported that accurate attendance ("1st Year Orientation: ~58 present") vanished from the
Dashboard / Attendance Log / Analytics, and that scanning wasn't recording students. The
investigation found **three issues plus one healthy-baseline confirmation**:

| #   | Issue                                                      | Severity                                      | Nature                                                | Data lost? |
| --- | ---------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- | ---------- |
| 1   | Pre-created "absent" rows **block scanning**               | **CRITICAL / live-ops**                       | DB + scan-API logic                                   | No         |
| 2   | "present" records **vanish from dashboard**                | High (display)                                | Read/query-window bug                                 | No         |
| 3   | Analytics "Monthly Trend"/"Total Sessions" show 0          | Low                                           | Reads empty legacy `qr_sessions`                      | No         |
| 4   | Check-in-only **attendees flipped `present`→`incomplete`** | Medium                                        | `backfillEventStatuses` + `check_in_only` toggled off | No         |
| 0   | **Origin: auto-backfill created the absent rows**          | Root cause (⚠️ partial fix landed, see below) | `backfillEventStatuses` over-marks                    | No         |
| —   | 2 records mislabeled `late` vs `present`                   | Minor                                         | Window edited after scan                              | No         |

The database itself is **healthy and complete**. Everything that looked like "lost data" is a
read-side/query artifact or the scanner being blocked by auto-created absent rows. **Issue 0 is
the upstream cause of Issues 1 and 2** — read it first.

---

## 1. Live database health (confirmed baseline — 2026-07-13 ~07:30Z)

| Table                                      | Rows  |
| ------------------------------------------ | ----- |
| `users`                                    | 691   |
| `student_profiles`                         | 679   |
| `events`                                   | 4     |
| `attendance_records`                       | 2,681 |
| `student_attendance_summary_mat` (matview) | 679   |

- **Integrity:** 0 rows with NULL `student_id`; 0 rows lacking both `event_id` and `session_id`;
  no duplicate (student, event) rows. Matview refreshed within the last hour.
- **Council accounts:** 12, all `status = approved` — 1 admin (`admin@usa.edu.ph`) + 11
  facilitators. RLS functions `is_admin()`/`is_council()` and RPCs
  `get_student_attendance_summary()` / `refresh_attendance_summary()` exist and are callable.
- `qr_sessions`: **0 rows** — the legacy self-check-in path is unused; all attendance is
  event-linked (`event_id` set).

**Conclusion:** not a data-loss or RLS/session problem. (Re-login did not and could not fix the
symptoms.)

---

## 2. Data model reference (must be preserved by any fix)

Students span **4 year levels, each with distinct sections**:

- 1st Year: PH 1A, 1B, 1C, 1D, 1E, 1F (~191 students)
- 2nd Year: PH 2A, 2B, 2C, 2D (~146)
- 3rd Year: PH 3A, 3B, 3C, 3D, 3E (~183)
- 4th Year: PH 4A, 4B, 4C, 4D (~159)

- Events target a year level via `events.target_year_levels` (e.g. First Year Orientation →
  `["1st Year"]`; CPMT = `null`, general).
- **`attendance_records` has NO year/section columns.** `current_year` and `section` live only
  on `student_profiles`, reached via `student_id → users → student_profiles`. Every stat card,
  breakdown, or filter by year/section **requires that join**.
- Attendance statuses are derived from event windows: `present` (scan ≤ `check_in_late`),
  `late` (`check_in_late` < scan ≤ `check_in_end`), `absent` (no scan after `check_in_end`),
  `incomplete` (`time_in` set, no `time_out` after `check_out_end`).

### Event snapshot (2026-07-13 investigation)

| Event                             | Date  | Check-in window (Z) | present | late | absent | incomplete |
| --------------------------------- | ----- | ------------------- | ------- | ---- | ------ | ---------- |
| CPMT Orientation                  | 07-10 | 03:30–04:55         | 0       | 0    | 317    | 353        |
| First Year Classroom Orientation  | 07-13 | 04:50–06:30         | 60      | 2    | 609    | 0          |
| Second Year Classroom Orientation | 07-13 | 06:30–07:10         | 0       | 0    | 670    | 0          |
| 3rd Year Classroom Orientation    | 07-13 | 07:50–08:45         | 0       | 0    | 670    | 0          |

Event IDs: 1st Year `e2010c23-0f19-4a7c-8350-75635896019b` · 2nd Year
`3f40a13c-9ff1-4ae1-95e7-9d1535563ac7` · 3rd Year `43ffc12a-97ed-4074-8294-140100181027` ·
CPMT `215fc1f0-ea3e-4846-a4ce-f737e5863829`.

---

# ISSUE 0 — ORIGIN: the automatic backfill created the absent rows

This is the **upstream root cause**. The absent rows behind Issues 1 and 2 were **not** a manual
SQL import — they were auto-created by `backfillEventStatuses` in `src/lib/attendance.ts`.

## Evidence

Every absent row carries `remarks = "Auto-marked: no scan recorded during the event."` and
`scanned_by = NULL` — this function's exact signature. Confirmed on 1st Year and CPMT.

## How the backfill works (and why it over-marked)

- It runs **opportunistically when a facilitator/admin opens a dashboard** (throttled ~1×/hour
  via `runIfDue`), looking back 60 days. Triggered from `dashboard/facilitator/page.tsx:45` and
  `dashboard/admin/page.tsx`.
- For **every event whose `check_in_end < now`** (line 46), it inserts an `absent` row for
  **every approved student who has no record for that event** (lines 61–68 select ALL approved
  students; lines 102–109 insert absents for the missing ones).
- **Flaw A — ignores `events.target_year_levels`.** It marks the _entire_ approved student body
  absent, not just the event's target year(s). Proof: CPMT (general) has 670 records spanning all
  4 year levels for a single event (1st:187, 2nd:143, 3rd:183, 4th:157); the 1st Year Orientation
  originally had ~671 rows (all years) before cleanup, though only ~191 students are 1st-years.
- **Flaw B — fires on any past `check_in_end`.** If an event exists with a `check_in_end` already
  in the past (created ahead with placeholder/elapsed times, or the window later edited to the
  real time), backfill immediately pre-populates absents. That is why 2nd/3rd Year were marked
  absent at 06:03Z — _before_ their 06:30/07:50 windows: at backfill time their `check_in_end`
  was in the past, and the windows were adjusted afterward. Same "windows edited after the fact"
  thread as the 2 mislabeled `late` records.

## The chain

Backfill auto-marks the whole school absent → those absent rows **block scanning** (Issue 1) and
**flood the dashboard's 2,000-row window** (Issue 2). One mechanism, two visible symptoms.

## Update — partial fix landed (commit `0ea6fb6`, 2026-07-13)

Commit `0ea6fb6` "fix for the backfillEventStatuses" added `target_year_levels` to the events
SELECT (`attendance.ts:45`) **but does not use it** — the student set is still the whole school
and `current_year` is not fetched, so **Flaw A is NOT yet fixed** (harmless no-op, no regression).
The fix below still needs to be completed.

## Fix

1. **Scope absents to the event's target year levels.** ⚠️ **Started but incomplete (commit
   `0ea6fb6`).** `target_year_levels` is now fetched; still TODO: (a) also load each student's
   `current_year` (the students query at `attendance.ts:61–66` selects only `id` — join
   `student_profiles.current_year`, or query `student_profiles`), and (b) in the per-event loop,
   build the "missing" set from only students whose `current_year ∈ ev.target_year_levels` (mark
   all years only when `target_year_levels` is null/empty = general event). This is what actually
   stops other-year students being wrongly marked absent.
2. **Make auto-absents non-blocking** (the durable safety net): implement Issue 1's scan-API
   branch so an existing `absent` row with `time_in IS NULL` is convertible to a check-in. Then
   even if backfill (or a window edit) pre-creates absents, a real scan still succeeds.
3. **Guard against premature backfill.** ✅ **Implemented (2026-07-13).** No-shows are auto-marked
   `absent` only once the event's check-in window has been closed for at least `ABSENT_SETTLE_MS`
   (1 hour, tunable) — so an event being set up ahead of time, or one whose window was edited after
   the fact, isn't pre-filled with absents while staff may still be scanning. Absent inserts also
   now use DO-NOTHING-on-conflict semantics (binary-split retry on `23505`) so they can neither
   drop valid absents on a race nor overwrite a real `present`/`late` record. Tests in
   `src/lib/__tests__/attendance.test.ts`. Note: the margin narrows but doesn't fully eliminate a
   window set _hours_ in the past — the durable protections remain the scan→placeholder conversion
   (Issue 1) and the operational rule of not editing windows mid-event.
4. Add tests in `src/lib/__tests__/attendance.test.ts`: (a) a year-specific event only marks its
   target year absent; (b) a general (`null`) event marks all years.

## Verification

- After the fix, backfilling a year-specific event inserts absents only for that year's students
  (count ≈ that year's enrollment minus attendees), not the whole school.
- CPMT (general) still marks all non-attendees across all years.

---

# ISSUE 1 — Pre-created "absent" rows BLOCK scanning (CRITICAL)

## Symptom

An event whose full roster was pre-marked `absent` via SQL import records **0 present** even
with the check-in window open and staff scanning — the scanner rejects every student with
_"Student has already checked in and out for this event."_ Observed: 2nd Year window
(06:30–07:10Z) closed with **0 present / 670 absent**; 3rd Year was set to hit the same fate.

## Root cause (CONFIRMED — `src/app/api/scan/route.ts`)

The scan API only converts a **nonexistent** record into a check-in. Trace for a student who
already has an `absent` row (`time_in = NULL`, `time_out = NULL`):

- `if (!existing)` (line 139) → **false** → skips CASE 1 (time-in insert).
- `if (existing.time_in && !existing.time_out)` (line 199) → **false** (`time_in` null) → skips
  CASE 2 (time-out).
- Falls through to **CASE 3** (line 264) → **HTTP 409 "Student has already checked in and out
  for this event."**

So a pre-marked-absent student can never check in. The 06:03Z roster import pre-created absent
rows for the 2nd/3rd Year events _before_ their windows opened, so every scan was rejected.
**1st Year escaped** only because its 62 students scanned at 04:55–06:12Z — _before_ the import
ran (no existing row → clean check-in).

## Immediate remediation (Supabase SQL editor — run BEFORE the event's window opens)

Delete only placeholder absents (rows with no real scan data) for the affected event so students
scan into a clean slate:

```sql
DELETE FROM public.attendance_records
WHERE event_id = '43ffc12a-97ed-4074-8294-140100181027'  -- swap per event (3rd Year shown)
  AND status = 'absent'
  AND time_in IS NULL;   -- placeholders only; never touches real scans
```

Nothing real is lost. After clearing: students scan → API creates fresh `present`/`late` → the
post-window `backfillEventStatuses` re-marks genuine no-shows `absent`. **Only works while the
window is still open or upcoming** — a closed window correctly rejects new scans, and would also
need the window extended (see below).

### Re-opening a window for students who were blocked (e.g. 2nd Year, already closed)

If a past event was blocked, give it a fresh window AND clear placeholders, then let students
re-scan:

```sql
UPDATE public.events
SET check_in_start = '<nowZ>', check_in_late = '<cutoffZ>', check_in_end = '<endZ>'
WHERE id = '3f40a13c-9ff1-4ae1-95e7-9d1535563ac7';  -- 2nd Year
-- then run the placeholder DELETE above for the same event_id
```

## Durable fixes

1. **Operational:** never import/pre-mark absents _before_ an event. Let students scan first;
   the existing `backfillEventStatuses` (in `src/lib/attendance.ts`) marks absents _after_
   `check_in_end` passes.
2. **Code (`src/app/api/scan/route.ts`):** add a branch so an existing record with
   `time_in IS NULL` is treated as a fresh check-in — update it to `present`/`late` with
   `time_in = now`, subject to the same window checks as CASE 1 — instead of falling through to
   the CASE 3 rejection. Makes pre-imported rosters harmless.
   - Add a test in `src/__tests__/api.scan.test.ts`: existing absent row (no `time_in`) + scan
     during window → row flips to `present`/`late`, not 409.

## Verification

1. On an event with pre-created absents, scan a student during the window → record flips to
   `present`/`late` (not a 409).
2. Post-window: no-shows `absent`, attendees `present`/`late`, counts sum to the roster.

---

# ISSUE 2 — "present" records vanish from the dashboard (display only)

## Symptom

Accurate attendance ("1st Year: ~58 present") collapsed to "1 present" on the Dashboard,
Attendance Log, and Analytics, while the data was clearly still in Supabase. Re-login did not
help.

## Root cause (CONFIRMED)

The **database is correct**; nothing was deleted or overwritten. The Attendance Log and Reports
fetch only the newest **~2,000** rows via `.order("created_at", { ascending: false }).limit(2000)`
(reports rely on PostgREST's ~1,000 default). The 06:03Z roster import created **~1,953 absent
rows in one burst**, which flooded that window and pushed the older `present` rows out of it.

**Evidence — First Year (`e2010c23…`):**

| Group                                   | Count                                      | created_at                                 |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| present + late (real scan session)      | **62**                                     | 04:55–05:09Z (+2 stragglers 06:02 / 06:12) |
| absent (roster import for non-scanners) | **609**                                    | single burst at **06:03Z**                 |
| total roster                            | 671 (671 distinct students, no duplicates) |                                            |

Simulating the log query (newest 2,000 by `created_at`) returns **1 present/late row of the 62
that exist**; the oldest row still inside the window is `06:03:12Z`. Everything older — the
entire 04:55–05:09 scan session — is outside the fetch window. Hence "58 → 1 present."

Re-login didn't help because it was never a session/RLS problem: `events` still render (policy
`SELECT USING (true)`); only the row-capped stat/log reads are truncated. Same failure class
commit `be7bb19` fixed for the admin log's _date filter_ — it still bites the
**default/unfiltered** log and the **reports** aggregation.

## No recovery needed

All 62 attended records for 1st Year are intact. **Do not** re-import or "repair" data.

## Fix

**Principle:** never derive per-event or aggregate attendance from a `created_at`-capped raw
fetch. Query by the indexed `event_id` joined to `student_profiles` (for year/section), or use a
server-side aggregate — so a bulk insert can't hide older rows and section/year filters keep
working.

1. **Attendance Log stat cards (Present / Late / Absent totals)** — compute from `count`-only
   queries per status, scoped to the current selection (event/date **and** year/section). Since
   section/year need the `student_profiles` join, either (a) use PostgREST embedded inner-join
   filters (`users.student_profiles.section=eq.X`), or (b) add a small `SECURITY DEFINER`
   aggregate RPC grouping by `event_id`/`status` (+ optional `current_year`/`section`), gated by
   `is_council()` like `get_student_attendance_summary`. Do **not** feed the cards from the
   capped row array.
   - `src/app/dashboard/facilitator/attendance/page.tsx` — `fetchAttendance`, the
     `.order("created_at").limit(2000)` at ~141–142.
   - `src/app/dashboard/admin/attendance/page.tsx` — same 2,000-row default view (`be7bb19` only
     fixed the _date-filtered_ branch; the default branch still caps).

2. **Attendance Log table (individual rows)** — for the default/all view, paginate (offset/keyset)
   or default to a specific event/date and fetch that event's rows by `event_id` (indexed by
   `idx_attendance`), joined to `users!student_id(student_profiles(section, current_year))` so
   year/section render — instead of a global newest-N window. Reuse the event-resolution pattern
   from `be7bb19`. Keep the `student_profiles(section)` join, not the null `qr_sessions.section`.

3. **Reports / Analytics per-event, per-year, per-section & present/absent numbers** —
   `src/app/dashboard/facilitator/reports/page.tsx` (records fetch ~250–256, "Most Attended
   Events" grouping ~285–313) and `src/app/dashboard/admin/reports/page.tsx` (~161–165): replace
   the bounded raw fetch used for per-event/section tallies with server-side aggregates grouped
   by `event_id` (+ `current_year`/`section` via the `student_profiles` join). Section breakdown
   must reflect all 4 year levels and their sections, not just those in a capped page. Overall
   per-student rates already come from the healthy `get_student_attendance_summary()` matview —
   leave those.

Use the local-date helpers (`parseDateLocal` in `src/lib/supabase.ts`) for month/day bucketing
to stay timezone-safe (Manila UTC+8).

## Verification

1. 1st Year stays at **62 present/late, 609 absent, 671 total** (data unchanged by the fix).
2. As approved admin, Attendance Log and Reports show 1st Year = **62 present/late** (not 1),
   regardless of the 06:03 absent burst.
3. Filter by year level and each section (PH 1A–1F, 2A–2D, 3A–3E, 4A–4D): per-section counts sum
   to event/year totals.
4. Create a fresh burst of dummy absent rows (scratch/test) and confirm older present rows still
   display.

---

# ISSUE 3 — Analytics "Monthly Trend" / "Total Sessions" show 0 (low priority)

## Root cause

`qr_sessions` has **0 rows** (attendance moved to the scanner/events flow), but the analytics
Monthly Trend and admin Total Sessions are computed from it:

- `src/app/dashboard/admin/reports/page.tsx:163` — only non-summary source is `qr_sessions`.
- `src/app/dashboard/facilitator/reports/page.tsx:257,352` — monthly trend from `qr_sessions`.

They render 0/flat even with a valid session and healthy data.

## Fix

Rewire Monthly Trend and Total Sessions to event-based `attendance_records`/`events` (the reports
pages already fetch event-linked records — reuse that data, group by `events.date` month). Lower
priority than Issues 1–2.

---

# ISSUE 4 — Check-in-only attendees flipped `present` → `incomplete` (CPMT)

## Symptom

For CPMT Orientation (a check-in-only event), the dashboard shows **0 present** and staff read it
as "everyone who attended was marked absent." Present data appears gone.

## Root cause (CONFIRMED)

The attendees are **not** absent — they were flipped to **`incomplete`**. CPMT's 670 records:

- **353 `incomplete`**, _all with a real `time_in`_ — the actual attendees; remark
  _"Auto-marked: time-in recorded but no time-out."_
- **317 `absent`** — genuine no-shows (no scan).

The backfill (`backfillEventStatuses`, `src/lib/attendance.ts:119–125`) marks any record with a
`time_in` but no `time_out` (past the checkout deadline — `check_out_end`, or `time_in + 4h` when
`check_out_end` is null) as `incomplete`, **unless `ev.check_in_only` is true**:

```js
const incomplete = ev.check_in_only
  ? []
  : existing.filter((r) => r.time_in && !r.time_out && deadlinePassed);
```

CPMT is `check_in_only = true` **now**, but must have been **`false` when the backfill ran** — so
the 353 checked-in-but-not-out attendees were marked `incomplete`. A check-in-only event has no
checkout, so those should be `present`. (Another "event flag/window changed after the fact"
interaction, same family as Issue 0.) The 0-present display is worsened by Issue 2 truncation.

## Recovery (SQL editor — safe now that `check_in_only = true`, so backfill won't re-flip)

```sql
UPDATE public.attendance_records
SET status = 'present',
    remarks = 'Restored: check-in-only attendee (no check-out required)'
WHERE event_id = '215fc1f0-ea3e-4846-a4ce-f737e5863829'   -- CPMT Orientation
  AND status = 'incomplete'
  AND time_in IS NOT NULL;
```

Result: CPMT reads **353 present / 317 absent / 0 incomplete**. (Optional present/late split:
`time_in <= '2026-07-10T04:51:00Z'` = present, else late — but the import intended `present`.)
**Do not toggle `check_in_only` off again** on a check-in-only event, or the backfill re-flips
attendees to `incomplete`.

## Durable fix

- Make the `check_in_only`→`incomplete` skip robust to the flag being toggled after attendance
  exists: e.g. never auto-mark `incomplete` for an event that has _no_ check-out window
  (`check_out_start`/`check_out_end` both null) — a check-in with no defined checkout can't be
  "incomplete." Add a test in `src/lib/__tests__/attendance.test.ts`.
- Reclassify existing `incomplete` rows back to `present` when an event is (re)set to
  `check_in_only` (the event edit handler already reclassifies some rows — extend it).

---

# Status-accuracy audit note (minor)

A full audit of all 2,681 records against their event windows found statuses **consistent**, with
one exception: in 1st Year, **2 records are `late` but their `time_in` (≈05:05Z) is before the
current late-cutoff (06:29Z)** — so under the current window they should be `present`. Students:
_Eugene Dennise P. Sta Cruz (PH 1E)_, _Ghernee Eliah Trivilegio (PH 1A)_. Cause: the event's
late-cutoff was **edited after** those scans; the scan API sets status at scan time and does not
retroactively reclassify. Optional one-off correction (only if the current window is authoritative):

```sql
UPDATE public.attendance_records SET status = 'present'
WHERE event_id = 'e2010c23-0f19-4a7c-8350-75635896019b'
  AND status = 'late'
  AND time_in <= '2026-07-13T06:29:00Z';
```

**Lesson:** editing an event's time window after scanning has begun creates inconsistencies (and
is entangled with Issue 2's absent burst). Avoid editing windows mid/post-event; if you must,
reclassify affected rows.

---

# Safety — fixing live, while scanning is ongoing

- **Issue 1 remediation (placeholder DELETE)** is safe: removes only rows with
  `time_in IS NULL AND status = 'absent'` (no real scan data) and unblocks check-ins. Confirm the
  deleted count matches the placeholder count.
- **Issue 1 code fix / Issue 2 fix / Issue 3 fix are read or additive:** the scan-API branch
  changes write logic in a strictly additive way (a previously-rejected case now succeeds);
  Issues 2–3 are read/display-only. None touch existing valid attendance rows.
- **Scanning is a separate write path.** `POST /api/scan` inserts records; the log/reports only
  read. Rewriting read queries cannot affect check-in recording.
- **Rolling deploy is non-disruptive.** Vercel swaps frontend code with in-flight requests
  draining; the offline-first scan queue (commit `c1acd7e`) captures scans client-side even if
  the backend blips mid-deploy, syncing after. No scans lost.
- **No data migration required.** Correct data already exists. Any aggregate RPC is _additive_
  DDL (`CREATE OR REPLACE FUNCTION`) — no table lock.

**Guardrails (avoid locking DDL during active scanning):**

- Any new index → `CREATE INDEX CONCURRENTLY` (plain `CREATE INDEX` briefly locks writes = blocks
  scans).
- New `is_council()`-gated RPC → **`GRANT EXECUTE ... TO authenticated`** (documented footgun: a
  missing grant makes RLS policies error "permission denied for function", blocking staff reads;
  scanning stays fine).
- Ship to a preview/branch, run `npm run type-check` + `npm test` (production build ignores
  TS/eslint errors — don't rely on it). Frontend changes roll back by redeploying the previous
  build; an additive RPC is harmless to leave in place.

---

# Suggested implementation order

1. **NOW (ops):** clear placeholder absents for any event whose window is open/upcoming (Issue 1
   remediation) so scanning works today.
2. **Short term (code):** Issue 1 scan-API `time_in IS NULL` → check-in branch + test — the
   durable safety net that makes any auto-created absent harmless (also fixes Issue 0 flaw B).
3. **Short term (code):** Issue 0 — **finish** scoping `backfillEventStatuses` to
   `target_year_levels` (commit `0ea6fb6` fetched the field but doesn't use it yet): load each
   student's `current_year` and filter the "missing" set per event, so year-specific events stop
   marking the whole school absent.
4. **NOW (ops, data):** run the Issue 4 recovery `UPDATE` to restore CPMT's 353 check-in-only
   attendees from `incomplete` back to `present`.
5. **Then:** Issue 2 attendance-log & reports off the `created_at` cap (stat cards first — most
   visible), preserving year/section.
6. **Short term (code):** Issue 4 durable fix — never auto-mark `incomplete` for events with no
   check-out window; reclassify on `check_in_only` re-enable.
7. **Later:** Issue 3 rewire analytics off empty `qr_sessions`; optional "late"→"present"
   correction for the 2 records.

# Appendix — how findings were verified

Read-only Node scripts using the service-role key from `.env.local` (SELECT/count only): row
counts & integrity; per-event status + `created_at` timelines; newest-2,000-window simulation
(returned 1 present of 62); council-account statuses; year×section distribution; scan-API trace
by reading `src/app/api/scan/route.ts`. No writes were performed against production.
