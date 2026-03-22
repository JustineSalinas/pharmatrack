-- PharmaTrack Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- SECURITY HELPERS (To avoid RLS recursion)
-- ============================================================

-- Function to check if the current user is an approved admin
-- SECURITY DEFINER skips RLS checks inside the function to avoid recursion.
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid()
    and account_type = 'admin'
    and status = 'approved'
  );
end;
$$ language plpgsql security definer set search_path = public;

-- Function to check if the current user is an approved council member
create or replace function public.is_council()
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid()
    and account_type in ('faculty', 'admin')
    and status = 'approved'
  );
end;
$$ language plpgsql security definer set search_path = public;

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

-- Nuke all policies on users to ensure a clean slate
do $$ 
declare 
    pol record;
begin 
    for pol in (select policyname from pg_policies where tablename = 'users' and schemaname = 'public') loop
        execute format('drop policy %I on public.users', pol.policyname);
    end loop;
end $$;

-- 1. Allow signup (anyone can insert if it matches their UID)
create policy "allow_signup" on public.users 
for insert with check (auth.uid() = id);

-- 2. Allow own select
create policy "allow_own_read" on public.users 
for select using (auth.uid() = id);

-- 3. Allow admins to manage (using loop-safe check)
create policy "allow_admin_manage_all" on public.users 
for all using ((auth.uid() != id) and public.is_admin());

-- ============================================================
-- STUDENT PROFILES
-- ============================================================
create table if not exists public.student_profiles (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.users(id) on delete cascade,
  student_id_number   text not null unique,
  section             text not null,
  current_year        text not null,
  qr_code_id          text not null unique, -- Permanent unique QR identifier
  created_at          timestamptz default now()
);

alter table public.student_profiles enable row level security;

drop policy if exists "Students can read their own profile" on public.student_profiles;
create policy "Students can read their own profile"
  on public.student_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all student profiles" on public.student_profiles;
create policy "Admins can read all student profiles"
  on public.student_profiles for select
  using (public.is_council());

-- ============================================================
-- EVENTS (Council Activities)
-- ============================================================
create table if not exists public.events (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  description         text,
  location            text not null,
  date                date not null,
  
  -- Time Windows for Scanning
  check_in_start     timestamptz not null,
  check_in_late      timestamptz not null, -- After this is "Late"
  check_in_end       timestamptz not null,
  
  check_out_start    timestamptz,
  check_out_end      timestamptz,
  
  created_by         uuid not null references public.users(id),
  created_at         timestamptz default now()
);

alter table public.events enable row level security;

drop policy if exists "Everyone can view events" on public.events;
create policy "Everyone can view events"
  on public.events for select
  using (true);

drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events"
  on public.events for all
  using (public.is_admin());

-- ============================================================
-- ATTENDANCE RECORDS
-- ============================================================
create table if not exists public.attendance_records (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references public.users(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  
  status      text not null check (status in ('present', 'late', 'absent', 'incomplete')),
  
  time_in     timestamptz,
  time_out    timestamptz,
  
  scanned_by  uuid references public.users(id), -- Admin who scanned the student
  remarks     text default '',
  created_at  timestamptz default now(),
  
  unique (student_id, event_id)
);

alter table public.attendance_records enable row level security;

drop policy if exists "Students can read their own attendance" on public.attendance_records;
create policy "Students can read their own attendance"
  on public.attendance_records for select
  using (auth.uid() = student_id);

drop policy if exists "Admins can manage attendance" on public.attendance_records;
create policy "Admins can manage attendance"
  on public.attendance_records for all
  using (public.is_council());

-- ============================================================
-- VIEWS & ANALYTICS
-- ============================================================

drop view if exists public.student_attendance_summary;
create or replace view public.student_attendance_summary as
select
  u.id as student_id,
  u.full_name,
  sp.student_id_number,
  sp.section,
  sp.current_year,
  count(*) as total_events,
  count(*) filter (where ar.status = 'present') as present_count,
  count(*) filter (where ar.status = 'late') as late_count,
  count(*) filter (where ar.status = 'absent') as absent_count,
  count(*) filter (where ar.status = 'incomplete') as incomplete_count,
  round(
    count(*) filter (where ar.status in ('present', 'late'))::numeric / nullif(count(*), 0) * 100, 1
  ) as attendance_rate
from public.users u
join public.student_profiles sp on sp.user_id = u.id
left join public.attendance_records ar on ar.student_id = u.id
where u.account_type = 'student'
group by u.id, u.full_name, sp.student_id_number, sp.section, sp.current_year;

