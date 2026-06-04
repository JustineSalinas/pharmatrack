-- ============================================================
-- PharmaTrack Unified Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SECURITY HELPERS
-- ============================================================

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- SECURITY DEFINER functions still require the *caller* role to hold EXECUTE.
-- Without these grants, every RLS policy that calls is_admin()/is_council()
-- fails with "permission denied for function is_admin" — which blocks even a
-- user reading their own profile row, and therefore breaks login entirely.
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
  created_at         TIMESTAMPTZ DEFAULT NOW()
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
DROP VIEW IF EXISTS public.student_attendance_summary;
CREATE OR REPLACE VIEW public.student_attendance_summary 
WITH (security_invoker = true) AS
SELECT
  u.id AS student_id,
  u.full_name,
  sp.student_id_number,
  sp.section,
  sp.current_year,
  COUNT(*) AS total_records,
  COUNT(*) FILTER (WHERE ar.status = 'present') AS present_count,
  COUNT(*) FILTER (WHERE ar.status = 'late') AS late_count,
  COUNT(*) FILTER (WHERE ar.status = 'absent') AS absent_count,
  COUNT(*) FILTER (WHERE ar.status = 'incomplete') AS incomplete_count,
  ROUND(
    COUNT(*) FILTER (WHERE ar.status IN ('present', 'late'))::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
  ) AS attendance_rate
FROM public.users u
JOIN public.student_profiles sp ON sp.user_id = u.id
LEFT JOIN public.attendance_records ar ON ar.student_id = u.id
WHERE u.account_type = 'student'
GROUP BY u.id, u.full_name, sp.student_id_number, sp.section, sp.current_year;

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
--   Email:    admin@usa.edu.ph
--   Password: PharmaAdmin2026!
--   ✅ Check "Auto Confirm User"
--
-- STEP 2: Copy the UUID, then run:
-- INSERT INTO public.users (id, email, full_name, account_type, status)
-- VALUES ('<PASTE-UUID-HERE>', 'admin@usa.edu.ph', 'System Administrator', 'admin', 'approved');

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
  USING (key NOT IN ('smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPass', 'smtpFrom'));

-- Allow admins to manage all config (routed through secure server-side settings endpoint)
CREATE POLICY "Admin manages config" ON public.system_config
  FOR ALL USING (public.is_admin());

-- Seed default values (safe to re-run — ON CONFLICT DO NOTHING)
INSERT INTO public.system_config (key, value) VALUES
  ('absenceNotifications', 'true'),
  ('weeklyReports',        'true'),
  ('lateThreshold',        '7:35 AM'),
  ('academicPeriod',       '2025–2026 · 2nd Semester'),
  ('qrExpiry',             '10 min'),
  ('minAttendance',        '75%'),
  ('twoFactorAuth',        'false'),
  ('registrationMode',     'approval'),
  ('smtpHost',             'smtp.gmail.com'),
  ('smtpPort',             '587'),
  ('smtpSecure',           'false'),
  ('smtpUser',             ''),
  ('smtpPass',             ''),
  ('smtpFrom',             'PharmaTrack <your-email@gmail.com>')
ON CONFLICT (key) DO NOTHING;
