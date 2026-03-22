-- ============================================================
-- PharmaTrack Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('student', 'faculty', 'admin')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STUDENT PROFILES
-- ============================================================
CREATE TABLE student_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id_number   TEXT NOT NULL UNIQUE,
  section             TEXT NOT NULL,
  current_year        TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FACULTY PROFILES
-- ============================================================
CREATE TABLE faculty_profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department  TEXT NOT NULL DEFAULT 'Pharmacy',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QR SESSIONS (created by faculty)
-- ============================================================
CREATE TABLE qr_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  section     TEXT NOT NULL,
  date        DATE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  code        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
CREATE TABLE attendance_records (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  UUID NOT NULL REFERENCES qr_sessions(id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  time_in     TIMESTAMPTZ,
  time_out    TIMESTAMPTZ,
  date        DATE NOT NULL,
  subject     TEXT NOT NULL,
  section     TEXT NOT NULL,
  remarks     TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (student_id, session_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Users: read own profile, admin reads all
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin reads all users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND account_type = 'admin')
);

-- Student profiles: student reads own
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student reads own profile" ON student_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Faculty/admin reads all profiles" ON student_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND account_type IN ('faculty','admin'))
);

-- QR Sessions: faculty creates, everyone authenticated can read
ALTER TABLE qr_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Faculty creates sessions" ON qr_sessions FOR INSERT WITH CHECK (auth.uid() = faculty_id);
CREATE POLICY "Authenticated reads sessions" ON qr_sessions FOR SELECT USING (auth.role() = 'authenticated');

-- Attendance: students insert own, faculty/admin reads all
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Student inserts own attendance" ON attendance_records FOR INSERT WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Student reads own attendance" ON attendance_records FOR SELECT USING (auth.uid() = student_id);
CREATE POLICY "Faculty/admin reads all attendance" ON attendance_records FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND account_type IN ('faculty','admin'))
);
CREATE POLICY "Faculty/admin updates attendance" ON attendance_records FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND account_type IN ('faculty','admin'))
);

-- ============================================================
-- SEED: Admin user (update with real UUID after creating via Auth)
-- ============================================================
-- INSERT INTO users (id, email, full_name, account_type)
-- VALUES ('your-admin-uuid-here', 'admin@pharmatrack.edu', 'Administrator', 'admin');
