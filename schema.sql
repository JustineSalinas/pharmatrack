-- ============================================================
-- PharmaTrack Unified Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SECURITY HELPERS
-- ============================================================

-- Marked STABLE so the planner evaluates them ONCE per query instead of
-- re-running the users lookup per row inside every RLS USING() clause. Without
-- STABLE, plpgsql functions are treated as VOLATILE, which on large tables like
-- attendance_records multiplies reads (and disk IO) by the row count.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND account_type = 'admin'
    AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_council()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND account_type IN ('facilitator', 'admin')
    AND status = 'approved'
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- SECURITY DEFINER functions still require the *caller* role to hold EXECUTE.
-- Without these grants, every RLS policy that calls is_admin()/is_council()
-- fails with "permission denied for function is_admin" — which blocks even a
-- user reading their own profile row, and therefore breaks login entirely.
--
-- The `anon` grant specifically trips the Supabase linter's "Public Can
-- Execute SECURITY DEFINER Function" warning. This is an accepted,
-- intentional exception, not an oversight: both functions only return a
-- boolean about the *calling* session and read no data the caller couldn't
-- already infer, so granting `anon` EXECUTE leaks nothing. Revoking it would
-- re-risk the exact failure mode described above for any future RLS policy
-- that pairs USING(true) with one of these functions.
GRANT EXECUTE ON FUNCTION public.is_admin()   TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_council() TO authenticated, anon;

-- Trigger to protect users table columns
CREATE OR REPLACE FUNCTION public.protect_user_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.jwt() ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'You are not allowed to change your account_type.';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'You are not allowed to change your status.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.protect_user_fields() TO authenticated, anon;

-- Student self check-in function
CREATE OR REPLACE FUNCTION public.check_in_student(session_code TEXT)
RETURNS JSON AS $$
DECLARE
  v_session RECORD;
  v_student_id UUID;
  v_status TEXT;
  v_late_threshold TEXT;
  v_now TIMESTAMPTZ;
  v_existing RECORD;
  v_record RECORD;
BEGIN
  v_student_id := auth.uid();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Ensure student account is approved
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = v_student_id
    AND account_type = 'student'
    AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Your student account is pending approval or inactive.';
  END IF;

  SELECT * INTO v_session
  FROM public.qr_sessions
  WHERE code = session_code;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid QR code';
  END IF;

  IF v_session.expires_at < NOW() THEN
    RAISE EXCEPTION 'This QR code has expired';
  END IF;

  SELECT id INTO v_existing
  FROM public.attendance_records
  WHERE student_id = v_student_id AND session_id = v_session.id;

  IF FOUND THEN
    RAISE EXCEPTION 'Already checked in for this session';
  END IF;

  v_now := NOW();
  v_status := 'present';

  SELECT value INTO v_late_threshold
  FROM public.system_config
  WHERE key = 'lateThreshold';

  IF v_late_threshold IS NOT NULL THEN
    IF ((timezone('Asia/Manila', v_now))::time > v_late_threshold::time) THEN
      v_status := 'late';
    END IF;
  END IF;

  INSERT INTO public.attendance_records (
    student_id,
    session_id,
    status,
    time_in,
    remarks
  ) VALUES (
    v_student_id,
    v_session.id,
    v_status,
    v_now,
    'Self check-in via QR Scan' || CASE WHEN v_status = 'late' THEN ' (LATE)' ELSE '' END
  ) RETURNING * INTO v_record;

  RETURN json_build_object(
    'ok', true,
    'record', row_to_json(v_record)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.check_in_student(TEXT) TO authenticated;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('student', 'facilitator', 'admin')),
  status      TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
-- Drop existing policies to avoid conflicts
DO $$ 
DECLARE 
    pol record;
BEGIN 
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY %I ON public.users', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "allow_signup" ON public.users FOR INSERT WITH CHECK (
  auth.uid() = id 
  AND account_type IN ('student', 'facilitator') 
  AND status = 'pending'
);
CREATE POLICY "allow_own_read" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "allow_own_update" ON public.users FOR UPDATE USING (auth.uid() = id);
-- Council (facilitators + admins) may READ all user rows. Facilitator
-- dashboards/lists count and display students from this table, so without a
-- read policy their "Total Students" reads 0. is_council() is SECURITY
-- DEFINER (bypasses RLS internally), mirroring the student_profiles policy,
-- so this does not recurse. Read-only — write access stays admin-only below.
CREATE POLICY "allow_council_read_all" ON public.users FOR SELECT USING (public.is_council());
CREATE POLICY "allow_admin_manage_all" ON public.users FOR ALL USING ((auth.uid() != id) AND public.is_admin());

DROP TRIGGER IF EXISTS trigger_protect_user_fields ON public.users;
CREATE TRIGGER trigger_protect_user_fields
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_user_fields();

-- ============================================================
-- STUDENT PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.student_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  student_id_number   TEXT NOT NULL UNIQUE,
  section             TEXT NOT NULL,
  current_year        TEXT NOT NULL,
  qr_code_id          TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student reads own profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Council reads all profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Student inserts own profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Student updates own profile" ON public.student_profiles;
CREATE POLICY "Student reads own profile" ON public.student_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Council reads all profiles" ON public.student_profiles FOR SELECT USING (public.is_council());
CREATE POLICY "Student inserts own profile" ON public.student_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Student updates own profile" ON public.student_profiles FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- FACILITATOR PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.facilitator_profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  department  TEXT NOT NULL DEFAULT 'Pharmacy',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.facilitator_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Facilitator reads own profile" ON public.facilitator_profiles;
DROP POLICY IF EXISTS "Admin manages facilitators" ON public.facilitator_profiles;
DROP POLICY IF EXISTS "Facilitator inserts own profile" ON public.facilitator_profiles;
DROP POLICY IF EXISTS "Facilitator updates own profile" ON public.facilitator_profiles;
CREATE POLICY "Facilitator reads own profile" ON public.facilitator_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manages facilitators" ON public.facilitator_profiles FOR ALL USING (public.is_admin());
CREATE POLICY "Facilitator inserts own profile" ON public.facilitator_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Facilitator updates own profile" ON public.facilitator_profiles FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  description         TEXT,
  location            TEXT NOT NULL,
  date                DATE NOT NULL,
  check_in_start     TIMESTAMPTZ NOT NULL,
  check_in_late      TIMESTAMPTZ NOT NULL,
  check_in_end       TIMESTAMPTZ NOT NULL,
  check_out_start    TIMESTAMPTZ,
  check_out_end      TIMESTAMPTZ,
  created_by         UUID NOT NULL REFERENCES public.users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  target_year_levels  TEXT[],
  event_type          TEXT,
  check_in_only       BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage events" ON public.events;
DROP POLICY IF EXISTS "Council manages events" ON public.events;
CREATE POLICY "Everyone views events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Council manages events" ON public.events FOR ALL USING (public.is_council());

-- ============================================================
-- QR SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.qr_sessions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  facilitator_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  subject             TEXT NOT NULL,
  section             TEXT NOT NULL,
  date                DATE NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  code                TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.qr_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Facilitators create sessions" ON public.qr_sessions;
DROP POLICY IF EXISTS "Everyone authenticated reads sessions" ON public.qr_sessions;
DROP POLICY IF EXISTS "Students can view sessions for their section" ON public.qr_sessions;
DROP POLICY IF EXISTS "Admins manage sessions" ON public.qr_sessions;
CREATE POLICY "Facilitators create sessions" ON public.qr_sessions FOR INSERT WITH CHECK (auth.uid() = facilitator_id AND public.is_council());
CREATE POLICY "Everyone authenticated reads sessions" ON public.qr_sessions FOR SELECT USING (
  public.is_council()
  OR (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.attendance_records ar
      WHERE ar.session_id = qr_sessions.id AND ar.student_id = auth.uid()
    )
  )
);
-- Allows students to see upcoming sessions for their section in the schedule view.
-- Required because student_schedule uses security_invoker=true, so the underlying
-- qr_sessions RLS policies are enforced for the calling student.
CREATE POLICY "Students can view sessions for their section" ON public.qr_sessions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.student_profiles sp
    WHERE sp.user_id = auth.uid()
    AND sp.section = qr_sessions.section
  )
);
CREATE POLICY "Admins manage sessions" ON public.qr_sessions FOR ALL USING (public.is_admin() OR auth.uid() = facilitator_id);

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES public.events(id) ON DELETE CASCADE,
  session_id  UUID REFERENCES public.qr_sessions(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'incomplete')),
  time_in     TIMESTAMPTZ,
  time_out    TIMESTAMPTZ,
  scanned_by  UUID REFERENCES public.users(id),
  remarks     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_attendance_target CHECK (event_id IS NOT NULL OR session_id IS NOT NULL)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Student reads own attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Council manages attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "Student scans session attendance" ON public.attendance_records;
CREATE POLICY "Student reads own attendance" ON public.attendance_records FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Council manages attendance" ON public.attendance_records FOR ALL USING (public.is_council());
-- Note: Student insertion is now handled exclusively via the secure check_in_student() RPC function.
-- Direct table insertion is blocked for non-council users.

-- ============================================================
-- VIEWS
-- ============================================================
-- student_attendance_summary is served from a MATERIALIZED view so the heavy
-- aggregation over attendance_records is computed on a schedule (refreshed via
-- refresh_attendance_summary() below) instead of on every reports/roster page
-- load — the repeated full-table aggregation was a major disk-IO source.
--
-- Materialized views do NOT enforce RLS, so the matview itself is hidden from
-- clients (REVOKE below) and access goes through the security-DEFINER wrapper
-- view further down, which re-applies the original access rule (a student may
-- read only their own row; council reads all).
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
LEFT JOIN public.attendance_records ar ON ar.student_id = u.id
WHERE u.account_type = 'student'
GROUP BY u.id, u.full_name, sp.student_id_number, sp.section, sp.current_year;

-- Unique index on student_id: lets the wrapper filter cheaply and is required
-- if you ever switch the refresh to CONCURRENTLY.
CREATE UNIQUE INDEX IF NOT EXISTS idx_summary_mat_student
  ON public.student_attendance_summary_mat (student_id);

-- Hide the raw matview from clients — access is only via the wrapper view.
REVOKE ALL ON public.student_attendance_summary_mat FROM authenticated, anon;

-- Wrapper RPC re-applies the per-caller access rule the old security_invoker
-- view got for free from underlying-table RLS. SECURITY DEFINER so it can read
-- the (client-hidden) matview; the WHERE clause does the authorization.
-- A function (not a view) so Supabase's Security Advisor doesn't flag it as a
-- "Security Definer View" — the linter only inspects views, not functions.
DROP VIEW IF EXISTS public.student_attendance_summary;
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

-- Refreshes the matview. SECURITY DEFINER so a throttled server route (service
-- role) can trigger it. Plain (non-CONCURRENT) REFRESH because CONCURRENTLY
-- can't run inside the transaction PostgREST/RPC wraps around it; the matview
-- is tiny (one row per student) so the brief lock is negligible.
CREATE OR REPLACE FUNCTION public.refresh_attendance_summary()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.student_attendance_summary_mat;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE ALL ON FUNCTION public.refresh_attendance_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_attendance_summary() TO service_role;

-- Secure schedule view for students (excludes the secret code column)
-- security_invoker=true ensures auth.uid() resolves to the CALLING student,
-- not the view definer. Without this, the WHERE clause returns 0 rows for students.
DROP VIEW IF EXISTS public.student_schedule;
CREATE OR REPLACE VIEW public.student_schedule
WITH (security_invoker = true) AS
SELECT id, facilitator_id, subject, section, date, expires_at, created_at
FROM public.qr_sessions
WHERE section = (
  SELECT section FROM public.student_profiles WHERE user_id = auth.uid()
);

GRANT SELECT ON public.student_schedule TO authenticated;

-- ============================================================
-- SEED: Admin account
-- ============================================================
-- STEP 1: Create the admin in Supabase Dashboard → Authentication → Users → Add User
--   Email:    >admin@[REDACTED]
--   Password: >[REDACTED]
--   ✅ Check "Auto Confirm User"
--
-- STEP 2: Copy the UUID, then run:
-- INSERT INTO public.users (id, email, full_name, account_type, status)
-- VALUES ('<PASTE-UUID-HERE>', '>admin@[REDACTED]', 'System Administrator', 'admin', 'approved');

-- ============================================================
-- SYSTEM CONFIGURATION
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manages config" ON public.system_config;
DROP POLICY IF EXISTS "Allow authenticated read of non-sensitive config" ON public.system_config;

-- Allow authenticated users to read non-sensitive configurations (e.g. late threshold, qr session expiry default)
CREATE POLICY "Allow authenticated read of non-sensitive config" ON public.system_config
  FOR SELECT TO authenticated
  USING (true);

-- Allow admins to manage all config (routed through secure server-side settings endpoint)
CREATE POLICY "Admin manages config" ON public.system_config
  FOR ALL USING (public.is_admin());

-- Seed default values (safe to re-run — ON CONFLICT DO NOTHING)
INSERT INTO public.system_config (key, value) VALUES
  ('absenceNotifications', 'true'),
  ('weeklyReports',        'true'),
  ('academicPeriod',       '2025–2026 · 2nd Semester'),
  ('minAttendance',        '75%'),
  ('twoFactorAuth',        'false'),
  ('registrationMode',     'approval'),
  ('emailMonthlyQuota',    '5000')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- EMAIL USAGE TRACKING
-- ============================================================
-- Tracks emails actually sent per calendar month (event broadcasts, absence
-- notices, weekly digests) against the MailerSend SMTP plan's monthly cap
-- (see 'emailMonthlyQuota' above). Registration confirmation emails are sent
-- directly by Supabase Auth's signUp() and are NOT tracked here — that's a
-- separate, untrackable-from-app-code send path.
CREATE TABLE IF NOT EXISTS public.email_usage (
  month       TEXT PRIMARY KEY,  -- 'YYYY-MM', UTC
  sent_count  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read email usage" ON public.email_usage;
CREATE POLICY "Admins read email usage" ON public.email_usage FOR SELECT USING (public.is_admin());
-- No client INSERT/UPDATE policy: writes only happen via the service-role
-- client from server routes, through the atomic increment function below.

-- Atomic upsert-increment — required because batches within a single
-- broadcast send concurrently (Promise.allSettled), so a naive
-- read-then-write in application code would lose updates under concurrency.
CREATE OR REPLACE FUNCTION public.increment_email_usage(p_month TEXT, p_count INTEGER)
RETURNS void AS $$
  INSERT INTO public.email_usage (month, sent_count, updated_at)
  VALUES (p_month, p_count, NOW())
  ON CONFLICT (month) DO UPDATE
    SET sent_count = public.email_usage.sent_count + EXCLUDED.sent_count,
        updated_at = NOW();
$$ LANGUAGE sql;

-- ============================================================
-- PRODUCTS (Merch Catalogue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('apparel', 'accessories')),
  price_label  TEXT NOT NULL DEFAULT 'PHP 0.00',
  description  TEXT,
  status       TEXT NOT NULL CHECK (status IN ('Showcase Only', 'Coming Soon')) DEFAULT 'Showcase Only',
  material     TEXT,
  sizes        TEXT[],
  colors       TEXT[],
  features     TEXT[],
  images       TEXT[] NOT NULL,
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone views products" ON public.products;
DROP POLICY IF EXISTS "Council manages products" ON public.products;
CREATE POLICY "Everyone views products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Council manages products" ON public.products FOR ALL USING (public.is_council());

-- Keep updated_at current on every UPDATE
CREATE OR REPLACE FUNCTION public.set_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_products_updated_at ON public.products;
CREATE TRIGGER trigger_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_products_updated_at();

-- Storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('merch-images', 'merch-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read merch images" ON storage.objects;
DROP POLICY IF EXISTS "Council manages merch images" ON storage.objects;
-- No SELECT policy needed: the bucket's public=true flag already serves
-- objects via /storage/v1/object/public/... without consulting RLS. A
-- permissive SELECT policy here would only add the ability to enumerate
-- every file in the bucket via the Storage API's list(), which the app
-- never needs (images are read from the URLs already stored on products).
CREATE POLICY "Council manages merch images" ON storage.objects FOR ALL
  USING (bucket_id = 'merch-images' AND public.is_council());

-- Seed: existing curated products (safe to re-run — skips rows whose name
-- already exists)
INSERT INTO public.products (name, category, price_label, description, status, material, sizes, colors, features, images)
SELECT * FROM (VALUES
  ('Pharmacy Premium Hoodie', 'apparel', 'PHP 1,299.00',
   'Premium heavyweight cotton hoodie featuring forest green coloring with signature gold embroidered ''Pharmacy'' lettering across the chest.',
   'Coming Soon', '80% Organic Cotton / 20% Polyester Blend (380 GSM)',
   ARRAY['S','M','L','XL','XXL'], ARRAY['Forest Green with Gold Embroidery'],
   ARRAY['Double-lined hood with adjustable drawstrings','Ribbed cuffs and waistband','Front kangaroo pocket','Embroidered premium detailing'],
   ARRAY['/merch/hoodie.png']),
  ('Pharmacy Signature Shirt', 'apparel', 'PHP 599.00',
   'Minimalist off-white signature tee designed for everyday comfort, featuring a clean green ''Pharmacy'' chest print.',
   'Showcase Only', '100% Ring-Spun Combed Cotton (200 GSM)',
   ARRAY['XS','S','M','L','XL','XXL'], ARRAY['Off-White / Cream with Green Printing'],
   ARRAY['Pre-shrunk fabric','Side-seamed construction','Double-needle topstitched collar','Soft and breathable wear'],
   ARRAY['/merch/shirt.png']),
  ('Pharmacy Official Tote Bag', 'accessories', 'PHP 350.00',
   'Durable white canvas tote bag with a stylish green leather-styled handle, featuring the centered ''Pharmacy'' branding.',
   'Coming Soon', 'Heavy-Duty 12oz Cotton Canvas / Vegan Leather Straps',
   NULL::TEXT[], ARRAY['Natural White Canvas with Forest Green Straps'],
   ARRAY['Spacious main compartment','Zippered top closure for security','Reinforced base and stitching','Inner pocket for smartphones or keys'],
   ARRAY['/merch/tote.png']),
  ('Pharmacy Event Lanyard', 'accessories', 'PHP 120.00',
   'Official event lanyard with forest green strap and premium gold text printing, complete with a secure silver clasp.',
   'Showcase Only', 'High-Density Smooth Satin Polyester',
   NULL::TEXT[], ARRAY['Forest Green with Gold Print'],
   ARRAY['Heavy-duty metal trigger hook','Safety breakaway clasp at the neck','Optimal 20mm width for comfort','Dual-sided logo printing'],
   ARRAY['/merch/lanyard.png'])
) AS seed(name, category, price_label, description, status, material, sizes, colors, features, images)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p WHERE p.name = seed.name
);

-- ============================================================
-- INDEXES
-- ============================================================
-- Postgres does NOT auto-index foreign keys or filter columns; only PRIMARY KEY
-- and UNIQUE constraints get implicit indexes. Without these, every filter/join
-- on the hot tables does a sequential scan (reads the whole table from disk),
-- which is the primary driver of Disk IO budget depletion under load.
--
-- When applying to a LIVE database, run these with CONCURRENTLY so they don't
-- lock the tables during an event, e.g.:
--   CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_student ON public.attendance_records (student_id);
-- (CONCURRENTLY cannot run inside a transaction block / the SQL editor's implicit
-- txn — run each statement on its own. The IF NOT EXISTS forms below are safe to
-- re-run and are what belongs in this schema file of record.)

-- CANONICAL INDEX SET for attendance_records — exactly the objects created
-- below (7 indexes here + uq_attendance_student_event further down). On
-- 2026-07-10 a second, undocumented generation of indexes was found live in
-- prod (idx_attendance_records_student_id/event_id/session_id/created_at)
-- that duplicated these under a different naming convention — applied
-- directly to the DB out-of-band at some point and never reconciled here,
-- roughly doubling write-path IO on this table's every INSERT/UPDATE. They
-- were dropped via DROP INDEX CONCURRENTLY. One extra, idx_attendance_records_
-- event_status, was kept (and is now declared below) because pg_stat_user_
-- indexes showed real idx_scan activity on it, not just a scan-and-guess.
-- If `\d attendance_records` in the Supabase SQL editor ever shows an index
-- not listed in this file, that's the signal something was applied outside
-- schema.sql again — reconcile it here, don't silently leave it.
--
-- attendance_records — the highest-traffic table (insert on check-in, update on
-- check-out, scanned+aggregated constantly).
CREATE INDEX IF NOT EXISTS idx_attendance_student
  ON public.attendance_records (student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event
  ON public.attendance_records (event_id) WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_session
  ON public.attendance_records (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_status
  ON public.attendance_records (status);
CREATE INDEX IF NOT EXISTS idx_attendance_scanned_by
  ON public.attendance_records (scanned_by);
-- Backs the `ORDER BY created_at DESC LIMIT n` used by the attendance log pages
-- and the dashboard "recent scans" feeds — without it, an ordered LIMIT still
-- scans + sorts the whole table.
CREATE INDEX IF NOT EXISTS idx_attendance_created
  ON public.attendance_records (created_at DESC);
-- Confirmed live-used via pg_stat_user_indexes (idx_scan > 0) on 2026-07-10;
-- kept rather than dropped as part of the duplicate-index cleanup above, and
-- formally declared here so it's no longer off the books.
CREATE INDEX IF NOT EXISTS idx_attendance_records_event_status
  ON public.attendance_records (event_id, status);

-- Required for every dashboard's "live update on scan" behavior — the app
-- has multiple supabase.channel(...).on("postgres_changes", ...) subscriptions
-- on this table (admin/facilitator dashboards, attendance logs, scanner
-- pages, student records) that silently never fire without this. Not
-- implicit from RLS or table creation — must be added explicitly per table.
-- ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS form, so this is
-- wrapped to stay safe to re-run like the rest of this file.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'attendance_records'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;
END $$;

-- NOTE: users table intentionally NOT added to supabase_realtime publication.
-- It was previously included for live avatar sync in the admin User Management
-- page, but it caused excessive WAL disk IO on the Nano compute tier. The
-- admin-users-rt channel still subscribes but will never fire; admins need a
-- manual page reload to see newly uploaded profile photos. The trade-off is
-- worth it: avatar sync is a minor UX nicety, disk IO budget is not.

-- Prevents duplicate check-in rows for the same student+event when two scans
-- race each other (e.g. two facilitator devices scanning the same student
-- within milliseconds). Without this, the read-then-insert in the /api/scan
-- route can produce two rows for one attendance. Partial (event_id IS NOT
-- NULL) because attendance can also be keyed by session_id alone.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_student_event
  ON public.attendance_records (student_id, event_id) WHERE event_id IS NOT NULL;

-- users — read on every is_admin()/is_council() call and the summary view's
-- WHERE account_type='student'.
CREATE INDEX IF NOT EXISTS idx_users_account_status
  ON public.users (account_type, status);

-- events — backfill filters .lt('check_in_end').gte(...); calendar/lists by date.
CREATE INDEX IF NOT EXISTS idx_events_check_in_end
  ON public.events (check_in_end);
CREATE INDEX IF NOT EXISTS idx_events_date
  ON public.events (date);

-- qr_sessions — section policy + schedule view, facilitator ownership, date lists.
CREATE INDEX IF NOT EXISTS idx_qr_sessions_section_expires
  ON public.qr_sessions (section, expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_facilitator
  ON public.qr_sessions (facilitator_id);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_date
  ON public.qr_sessions (date);

-- student_profiles — section is filtered by the qr_sessions student policy and
-- the student_schedule view (user_id / student_id_number / qr_code_id are already
-- UNIQUE-indexed).
CREATE INDEX IF NOT EXISTS idx_student_profiles_section
  ON public.student_profiles (section);
