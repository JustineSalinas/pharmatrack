import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

const sql = `
CREATE OR REPLACE FUNCTION public.insert_attendance_record_safe(
  p_student_id UUID,
  p_event_id UUID,
  p_status TEXT,
  p_time_in TIMESTAMPTZ DEFAULT NULL,
  p_time_out TIMESTAMPTZ DEFAULT NULL,
  p_scanned_by UUID DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL
) RETURNS SETOF public.attendance_records
LANGUAGE sql
AS $$
  INSERT INTO public.attendance_records
    (student_id, event_id, status, time_in, time_out, scanned_by, remarks)
  VALUES
    (p_student_id, p_event_id, p_status, p_time_in, p_time_out, p_scanned_by, p_remarks)
  ON CONFLICT (student_id, event_id) WHERE event_id IS NOT NULL DO NOTHING
  RETURNING *;
$$;
GRANT EXECUTE ON FUNCTION public.insert_attendance_record_safe(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.insert_absent_records_batch(p_rows JSONB)
RETURNS SETOF public.attendance_records
LANGUAGE sql
AS $$
  INSERT INTO public.attendance_records (student_id, event_id, status, remarks)
  SELECT (r->>'student_id')::UUID, (r->>'event_id')::UUID, r->>'status', r->>'remarks'
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (student_id, event_id) WHERE event_id IS NOT NULL DO NOTHING
  RETURNING *;
$$;
GRANT EXECUTE ON FUNCTION public.insert_absent_records_batch(JSONB) TO authenticated;
`;

async function main() {
  try {
    await client.connect();
    console.log("Connected. Applying insert_attendance_record_safe() and insert_absent_records_batch()...");
    await client.query(sql);
    console.log("Applied successfully.");

    const check = await client.query(
      `SELECT proname, pronargs FROM pg_proc WHERE proname IN ('insert_attendance_record_safe', 'insert_absent_records_batch') ORDER BY proname`
    );
    console.log("Verification:", check.rows);
  } catch (err) {
    console.error("Failed to apply function:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
