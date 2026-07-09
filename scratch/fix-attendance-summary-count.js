const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set in .env.local');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// Recreates student_attendance_summary_mat with COUNT(ar.id) instead of COUNT(*)
// for total_records/attendance_rate, so students with zero attendance_records
// (a LEFT JOIN with no match still produces one row) correctly show 0 sessions
// instead of a phantom 1. See schema.sql for the canonical definition.
const sql = `
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
LEFT JOIN public.attendance_records ar ON ar.student_id = u.id
WHERE u.account_type = 'student'
GROUP BY u.id, u.full_name, sp.student_id_number, sp.section, sp.current_year;

CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_mat_student
  ON public.student_attendance_summary_mat (student_id);

REVOKE ALL ON public.student_attendance_summary_mat FROM authenticated, anon;

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

CREATE OR REPLACE FUNCTION public.refresh_attendance_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.student_attendance_summary_mat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.refresh_attendance_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_attendance_summary() TO service_role;
`;

async function main() {
  try {
    await client.connect();
    console.log('Connected. Recreating student_attendance_summary_mat with COUNT(ar.id)...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Materialized view + wrapper function recreated successfully.');

    const { rows } = await client.query(
      `SELECT student_id, full_name, total_records, present_count, attendance_rate
       FROM public.student_attendance_summary_mat
       WHERE total_records = 0
       LIMIT 5;`
    );
    console.log(`Sample of students with 0 total_records (should now show 0, not 1):`, rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed to apply fix:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
