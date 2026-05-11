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
DO $$ 
DECLARE 
    pol record;
BEGIN 
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY %I ON public.users', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "allow_signup" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "allow_own_read" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "allow_own_update" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "allow_admin_manage_all" ON public.users FOR ALL USING ((auth.uid() != id) AND public.is_admin());

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
CREATE POLICY "Student reads own profile" ON public.student_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Council reads all profiles" ON public.student_profiles FOR SELECT USING (public.is_council());
CREATE POLICY "Student inserts own profile" ON public.student_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

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
CREATE POLICY "Facilitator reads own profile" ON public.facilitator_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin manages facilitators" ON public.facilitator_profiles FOR ALL USING (public.is_admin());

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
DROP POLICY IF EXISTS "Everyone views events" ON public.events;
DROP POLICY IF EXISTS "Admins manage events" ON public.events;
CREATE POLICY "Everyone views events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Admins manage events" ON public.events FOR ALL USING (public.is_admin());

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
DROP POLICY IF EXISTS "Admins manage sessions" ON public.qr_sessions;
CREATE POLICY "Facilitators create sessions" ON public.qr_sessions FOR INSERT WITH CHECK (auth.uid() = facilitator_id AND public.is_council());
CREATE POLICY "Everyone authenticated reads sessions" ON public.qr_sessions FOR SELECT USING (auth.role() = 'authenticated');
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
CREATE POLICY "Student scans session attendance" ON public.attendance_records FOR INSERT WITH CHECK (auth.uid() = student_id);

-- ============================================================
-- VIEWS
-- ============================================================
DROP VIEW IF EXISTS public.student_attendance_summary;
CREATE OR REPLACE VIEW public.student_attendance_summary AS
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
