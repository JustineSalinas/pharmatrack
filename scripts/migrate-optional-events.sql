-- ============================================================================
-- Optional events ("doesn't count toward attendance") — 2026-09-13
--
-- Paste the whole file into the Supabase SQL editor and run it ONCE. It is
-- safe to re-run. Takes a few seconds; the attendance summary is briefly
-- unavailable while the materialized view is rebuilt (a dashboard opened in
-- that window shows blank tiles until its next refresh).
--
-- What it does:
--   1. Adds events.counts_toward_attendance (default TRUE — every existing
--      event keeps counting exactly as before).
--   2. Rebuilds student_attendance_summary_mat to ignore records from
--      optional events, so a skipped sport can't lower anyone's rate and an
--      attended one can't pad it. Recreates the wrapper function that the
--      CASCADE drop takes with it.
--   3. Adds get_optional_event_tally() — one row per approved student with how
--      many optional events they attended (for "attend 5 of 15").
--
-- Deploy order does not matter: the backfill reads events with select("*"),
-- so before this runs the column is simply absent (undefined) and every event
-- keeps counting exactly as it always has.
-- ============================================================================

-- 1. Column ------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS counts_toward_attendance BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.counts_toward_attendance IS
  'false = optional event (e.g. an intramurals sport). Scans are recorded so attendance can be tallied, but the backfill never marks anyone absent for it and the attendance-rate matview ignores it.';

-- 2. Rebuild the summary matview + its wrapper ------------------------------
DROP VIEW IF EXISTS public.student_attendance_summary;
DROP MATERIALIZED VIEW IF EXISTS public.student_attendance_summary_mat CASCADE;

CREATE MATERIALIZED VIEW public.student_attendance_summary_mat AS
SELECT
  u.id AS student_id,
  u.full_name,
  sp.student_id_number,
  sp.section,
  sp.current_year,
  COUNT(ar.id) AS total_records,
  COUNT(*) FILTER (WHERE ar.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE ar.status = 'late') AS late_count,
  COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent_count,
  COUNT(*) FILTER (WHERE ar.status = 'incomplete') AS incomplete_count,
  ROUND(
    COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))::NUMERIC / NULLIF(COUNT(ar.id), 0) * 100, 1
  ) AS attendance_rate
FROM public.users u
JOIN public.student_profiles sp ON sp.user_id = u.id
-- Records for optional events are excluded so they can neither raise nor
-- lower a student's rate. Session-based records (event_id NULL) unaffected.
LEFT JOIN public.attendance_records ar
  ON ar.student_id = u.id
  AND NOT EXISTS (
    SELECT 1 FROM public.events ex
    WHERE ex.id = ar.event_id AND ex.counts_toward_attendance = false
  )
WHERE u.account_type = 'student'
GROUP BY u.id, u.full_name, sp.student_id_number, sp.section, sp.current_year;

CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_mat_student
  ON public.student_attendance_summary_mat (student_id);

REVOKE ALL ON public.student_attendance_summary_mat FROM authenticated, anon;

-- Dropped by the CASCADE above (it returns SETOF the matview's row type).
CREATE OR REPLACE FUNCTION public.get_student_attendance_summary()
RETURNS SETOF public.student_attendance_summary_mat
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT m.*
  FROM public.student_attendance_summary_mat m
  WHERE public.is_council() OR m.student_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_student_attendance_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_student_attendance_summary() TO authenticated;

-- 3. Per-student optional-event tally ----------------------------------------
CREATE OR REPLACE FUNCTION public.get_optional_event_tally()
RETURNS TABLE (
  student_id UUID,
  full_name TEXT,
  student_id_number TEXT,
  section TEXT,
  current_year TEXT,
  events_attended BIGINT,
  events_list TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    u.id AS student_id,
    u.full_name,
    sp.student_id_number,
    sp.section,
    sp.current_year,
    COUNT(DISTINCT e.id) AS events_attended,
    STRING_AGG(DISTINCT e.name, ', ' ORDER BY e.name) AS events_list
  FROM public.users u
  JOIN public.student_profiles sp ON sp.user_id = u.id
  LEFT JOIN public.attendance_records ar
    ON ar.student_id = u.id AND ar.status IN ('present', 'late')
  LEFT JOIN public.events e
    ON e.id = ar.event_id AND e.counts_toward_attendance = false
  WHERE public.is_council()
    AND u.account_type = 'student'
    AND u.status = 'approved'
  GROUP BY u.id, u.full_name, sp.student_id_number, sp.section, sp.current_year
  ORDER BY sp.current_year, sp.section, u.full_name;
$$;
REVOKE ALL ON FUNCTION public.get_optional_event_tally() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_optional_event_tally() TO authenticated;

-- 4. Sanity check — should return one row, all three TRUE ---------------------
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_name = 'events' AND column_name = 'counts_toward_attendance') AS column_added,
  EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'student_attendance_summary_mat') AS matview_rebuilt,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_optional_event_tally') AS tally_function_ready;
