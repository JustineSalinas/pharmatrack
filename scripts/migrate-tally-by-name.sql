-- ============================================================================
-- Count optional-event attendance by SPORT NAME, not by event.id — 2026-09-13
--
-- Paste this into the Supabase SQL editor and run it once. Safe to re-run.
-- No DROP involved this time — this only replaces one function definition,
-- so there is no "destructive operation" warning and nothing to rebuild.
--
-- Why: a sport that runs across several days (Basketball, Volleyball,
-- Football, E-Sports: Tue-Fri; others: 2 days) can't be created as ONE
-- PharmaTrack event, because the event form pins its check-in window to a
-- single calendar date. So a multi-day sport becomes several same-named
-- events — one per day it's held. The tally previously counted DISTINCT
-- event.id, which would let a student who played Basketball on 3 of its 4
-- days count it as 3 of their 5 required events. This counts by event NAME
-- instead, so it's always exactly 1 regardless of how many days they showed
-- up. Requires facilitators to spell the sport's name the same way each day
-- it's created (case and stray spaces don't matter — this normalizes both).
-- ============================================================================

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
    COUNT(DISTINCT LOWER(TRIM(e.name))) AS events_attended,
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

-- Sanity check — should return true.
SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_optional_event_tally') AS tally_function_updated;
