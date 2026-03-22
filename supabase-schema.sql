-- PharmaTrack Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS TABLE
-- ============================================================
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  full_name   text not null,
  account_type text not null check (account_type in ('student', 'faculty', 'admin')),
  status      text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz default now()
);

alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Admins can read all users"
  on public.users for all
  using (
    exists (select 1 from public.users where id = auth.uid() and account_type = 'admin')
  );

-- ============================================================
-- STUDENT PROFILES
-- ============================================================
create table if not exists public.student_profiles (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.users(id) on delete cascade,
  student_id_number   text not null unique,
  section             text not null,
  current_year        text not null,
  created_at          timestamptz default now()
);

alter table public.student_profiles enable row level security;

create policy "Students can read their own profile"
  on public.student_profiles for select
  using (auth.uid() = user_id);

create policy "Faculty and admins can read all student profiles"
  on public.student_profiles for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and account_type in ('faculty', 'admin')
    )
  );

-- ============================================================
-- FACULTY PROFILES
-- ============================================================
create table if not exists public.faculty_profiles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  department  text not null default 'Pharmacy',
  created_at  timestamptz default now()
);

alter table public.faculty_profiles enable row level security;

create policy "Faculty can read their own profile"
  on public.faculty_profiles for select
  using (auth.uid() = user_id);

-- ============================================================
-- QR SESSIONS
-- ============================================================
create table if not exists public.qr_sessions (
  id          uuid primary key default uuid_generate_v4(),
  faculty_id  uuid not null references public.users(id) on delete cascade,
  subject     text not null,
  section     text not null,
  date        date not null,
  expires_at  timestamptz not null,
  code        text not null unique,
  created_at  timestamptz default now()
);

alter table public.qr_sessions enable row level security;

create policy "Faculty can create QR sessions"
  on public.qr_sessions for insert
  with check (
    auth.uid() = faculty_id and
    exists (select 1 from public.users where id = auth.uid() and account_type = 'faculty')
  );

create policy "Authenticated users can read QR sessions"
  on public.qr_sessions for select
  using (auth.role() = 'authenticated');

create policy "Admins have full access to QR sessions"
  on public.qr_sessions for all
  using (
    exists (select 1 from public.users where id = auth.uid() and account_type = 'admin')
  );

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
create table if not exists public.attendance_records (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references public.users(id) on delete cascade,
  session_id  uuid not null references public.qr_sessions(id) on delete cascade,
  status      text not null check (status in ('present', 'absent', 'late')),
  time_in     timestamptz,
  time_out    timestamptz,
  date        date not null,
  subject     text not null,
  section     text not null,
  remarks     text default '',
  created_at  timestamptz default now(),
  unique (student_id, session_id)  -- prevent duplicate check-ins
);

alter table public.attendance_records enable row level security;

create policy "Students can insert their own attendance"
  on public.attendance_records for insert
  with check (auth.uid() = student_id);

create policy "Students can read their own attendance"
  on public.attendance_records for select
  using (auth.uid() = student_id);

create policy "Faculty can read attendance for their sessions"
  on public.attendance_records for select
  using (
    exists (
      select 1 from public.qr_sessions qs
      join public.users u on u.id = auth.uid()
      where qs.id = session_id
      and (qs.faculty_id = auth.uid() or u.account_type in ('faculty', 'admin'))
    )
  );

create policy "Admins have full access to attendance"
  on public.attendance_records for all
  using (
    exists (select 1 from public.users where id = auth.uid() and account_type = 'admin')
  );

-- ============================================================
-- HELPER VIEWS
-- ============================================================

-- Student attendance summary view
create or replace view public.student_attendance_summary as
select
  u.id as student_id,
  u.full_name,
  sp.student_id_number,
  sp.section,
  sp.current_year,
  count(*) as total_classes,
  count(*) filter (where ar.status = 'present') as present_count,
  count(*) filter (where ar.status = 'absent') as absent_count,
  count(*) filter (where ar.status = 'late') as late_count,
  round(
    count(*) filter (where ar.status = 'present')::numeric / nullif(count(*), 0) * 100, 1
  ) as attendance_rate
from public.users u
join public.student_profiles sp on sp.user_id = u.id
left join public.attendance_records ar on ar.student_id = u.id
where u.account_type = 'student'
group by u.id, u.full_name, sp.student_id_number, sp.section, sp.current_year;

-- ============================================================
-- SEED DATA (optional — for development)
-- ============================================================
-- Uncomment to insert a default admin user after creating via Supabase Auth
-- insert into public.users (id, email, full_name, account_type)
-- values ('<your-admin-auth-uid>', 'admin@pharmatrack.edu', 'Administrator', 'admin')
-- on conflict do nothing;
