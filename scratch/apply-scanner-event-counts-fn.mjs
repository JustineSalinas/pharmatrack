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
CREATE OR REPLACE FUNCTION public.get_scanner_event_counts(p_event_id UUID)
RETURNS TABLE (
  total BIGINT,
  present BIGINT,
  late BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'present') AS present,
    COUNT(*) FILTER (WHERE status = 'late') AS late
  FROM public.attendance_records
  WHERE public.is_council()
    AND event_id = p_event_id;
$$;
REVOKE ALL ON FUNCTION public.get_scanner_event_counts(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_scanner_event_counts(UUID) TO authenticated;
`;

async function main() {
  try {
    await client.connect();
    console.log("Connected. Applying get_scanner_event_counts()...");
    await client.query(sql);
    console.log("Applied successfully.");

    const check = await client.query(
      `SELECT proname, pronargs FROM pg_proc WHERE proname = 'get_scanner_event_counts'`
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
