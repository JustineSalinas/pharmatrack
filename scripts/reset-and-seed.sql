-- ============================================================
-- PharmaTrack: FULL RESET & ADMIN SEED
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================
-- WARNING: This will DELETE all data permanently!
-- ============================================================

-- Step 1: Delete all data from public tables (order matters for FK constraints)
DELETE FROM public.attendance_records;
DELETE FROM public.qr_sessions;
DELETE FROM public.events;
DELETE FROM public.student_profiles;
DELETE FROM public.facilitator_profiles;
DELETE FROM public.users;

-- Step 2: Delete all users from Supabase Auth
-- This requires running in the SQL Editor with service_role permissions
DELETE FROM auth.users;

-- Step 3: Verify cleanup
SELECT 'auth.users count:' AS check_name, COUNT(*) AS count FROM auth.users
UNION ALL
SELECT 'public.users count:', COUNT(*) FROM public.users
UNION ALL
SELECT 'student_profiles count:', COUNT(*) FROM public.student_profiles
UNION ALL
SELECT 'facilitator_profiles count:', COUNT(*) FROM public.facilitator_profiles
UNION ALL
SELECT 'attendance_records count:', COUNT(*) FROM public.attendance_records;

-- ============================================================
-- Step 4: Seed the Admin Account
-- ============================================================
-- IMPORTANT: After running the DELETE statements above,
-- go to Supabase Dashboard → Authentication → Users → "Add User"
--   Email: admin@usa.edu.ph
--   Password: PharmaAdmin2026!
--   Check "Auto Confirm User" ✅
--
-- Then copy the UUID from the new user row and replace <ADMIN_UUID> below:
-- ============================================================

-- UNCOMMENT AND RUN THIS AFTER creating the auth user in the dashboard:
-- INSERT INTO public.users (id, email, full_name, account_type, status)
-- VALUES ('<ADMIN_UUID>', 'admin@usa.edu.ph', 'System Administrator', 'admin', 'approved');
