-- ============================================================================
-- Count optional-event attendance by SPORT/BATCH NAME — 2026-09-15
--
-- Paste this into the Supabase SQL editor and run it once. Safe to re-run.
-- No DROP involved — this only replaces the function definition.
--
-- Logic:
-- 1. Multi-day sports created with identical names (e.g. Basketball, Lawn Tennis)
--    normalize to the same name so attending across multiple days counts as 1.
-- 2. Chess is grouped into TWO separate batches per department policy:
--    - Morning batch (Rounds 1, 2, 3, 4, Morning, AM, Batch 1) -> "Chess (Morning)"
--    - Afternoon batch (Rounds 5, 6, 7, 8, 9, Afternoon, PM, Batch 2) -> "Chess (Afternoon)"
--    Attending multiple morning rounds yields 1 tally; attending multiple
--    afternoon rounds yields 1 tally; attending both yields 2 tallies total.
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
    COUNT(DISTINCT
      CASE
        WHEN LOWER(e.name) LIKE '%chess%' AND (
          LOWER(e.name) LIKE '%round 1%' OR
          LOWER(e.name) LIKE '%round 2%' OR
          LOWER(e.name) LIKE '%round 3%' OR
          LOWER(e.name) LIKE '%round 4%' OR
          LOWER(e.name) LIKE '%morning%' OR
          LOWER(e.name) LIKE '%batch 1%' OR
          LOWER(e.name) LIKE '%1st batch%'
        ) THEN 'chess_morning'
        WHEN LOWER(e.name) LIKE '%chess%' AND (
          LOWER(e.name) LIKE '%round 5%' OR
          LOWER(e.name) LIKE '%round 6%' OR
          LOWER(e.name) LIKE '%round 7%' OR
          LOWER(e.name) LIKE '%round 8%' OR
          LOWER(e.name) LIKE '%round 9%' OR
          LOWER(e.name) LIKE '%afternoon%' OR
          LOWER(e.name) LIKE '%batch 2%' OR
          LOWER(e.name) LIKE '%2nd batch%'
        ) THEN 'chess_afternoon'
        ELSE LOWER(TRIM(e.name))
      END
    ) AS events_attended,
    STRING_AGG(DISTINCT
      CASE
        WHEN LOWER(e.name) LIKE '%chess%' AND (
          LOWER(e.name) LIKE '%round 1%' OR
          LOWER(e.name) LIKE '%round 2%' OR
          LOWER(e.name) LIKE '%round 3%' OR
          LOWER(e.name) LIKE '%round 4%' OR
          LOWER(e.name) LIKE '%morning%' OR
          LOWER(e.name) LIKE '%batch 1%' OR
          LOWER(e.name) LIKE '%1st batch%'
        ) THEN 'Chess (Morning - 1st Batch)'
        WHEN LOWER(e.name) LIKE '%chess%' AND (
          LOWER(e.name) LIKE '%round 5%' OR
          LOWER(e.name) LIKE '%round 6%' OR
          LOWER(e.name) LIKE '%round 7%' OR
          LOWER(e.name) LIKE '%round 8%' OR
          LOWER(e.name) LIKE '%round 9%' OR
          LOWER(e.name) LIKE '%afternoon%' OR
          LOWER(e.name) LIKE '%batch 2%' OR
          LOWER(e.name) LIKE '%2nd batch%'
        ) THEN 'Chess (Afternoon - 2nd Batch)'
        ELSE e.name
      END,
      ', '
    ) AS events_list
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
