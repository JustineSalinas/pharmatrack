-- PharmaTrack Unified Database Schema
-- Run this in Supabase SQL Editor to set up all tables

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- SECURITY HELPERS
-- ============================================================

-- Check if current user is an approved admin
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

-- Check if current user is an admin or approved facilitator (Council)
create or replace function public.is_council()
returns boolean as $$
begin
  return exists (
    select 1 from public.users
    where id = auth.uid()
    and account_type in ('facilitator', 'admin')
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
  account_type text not null check (account_type in ('student', 'facilitator', 'admin')),
  status      text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
  created_at  timestamptz default now()
);

alter table public.users enable row level security;

-- Nuke and recreate clean policies
do $$ 
declare 
    pol record;
begin 
    for pol in (select policyname from pg_policies where tablename = 'users' and schemaname = 'public') loop
        execute format('drop policy %I on public.users', pol.policyname);
    end loop;
end $$;

create policy "allow_signup" on public.users for insert with check (auth.uid() = id);
create policy "allow_own_read" on public.users for select using (auth.uid() = id);
create policy "allow_own_update" on public.users for update using (auth.uid() = id);
create policy "allow_admin_manage_all" on public.users for all using ((auth.uid() != id) and public.is_admin());

-- ============================================================
-- STUDENT PROFILES
-- ============================================================
create table if not exists public.student_profiles (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null unique references public.users(id) on delete cascade,
  student_id_number   text not null unique,
  section             text not null,
  current_year        text not null,
  qr_code_id          text not null unique, -- Permanent unique identity QR
  created_at          timestamptz default now()
);

alter table public.student_profiles enable row level security;

-- Nuke and recreate clean policies
do $$ 
declare 
    pol record;
begin 
    for pol in (select policyname from pg_policies where tablename = 'student_profiles' and schemaname = 'public') loop
        execute format('drop policy %I on public.student_profiles', pol.policyname);
    end loop;
end $$;

drop policy if exists "Students can read their own profile" on public.student_profiles;
create policy "Students can read their own profile" on public.student_profiles for select using (auth.uid() = user_id);

drop policy if exists "Admins can read all student profiles" on public.student_profiles;
create policy "Admins and Facilitators can read all student profiles" on public.student_profiles for select using (public.is_council());

drop policy if exists "Students can insert their own profile" on public.student_profiles;
create policy "Students can insert their own profile" on public.student_profiles for insert with check (auth.uid() = user_id);

-- ============================================================
-- FACILITATOR PROFILES (Renamed from Faculty)
-- ============================================================
create table if not exists public.facilitator_profiles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null unique references public.users(id) on delete cascade,
  department  text not null default 'Pharmacy',
  created_at  timestamptz default now()
);

alter table public.facilitator_profiles enable row level security;

-- Nuke and recreate clean policies
do $$ 
declare 
    pol record;
begin 
    for pol in (select policyname from pg_policies where tablename = 'facilitator_profiles' and schemaname = 'public') loop
        execute format('drop policy %I on public.facilitator_profiles', pol.policyname);
    end loop;
end $$;

create policy "Facilitators can read their own profile" on public.facilitator_profiles for select using (auth.uid() = user_id);
create policy "Admins can manage facilitator profiles" on public.facilitator_profiles for all using (public.is_admin());
create policy "Facilitators can insert their own profile" on public.facilitator_profiles for insert with check (auth.uid() = user_id);

-- ============================================================
-- EVENTS (School-wide activities)
-- ============================================================
create table if not exists public.events (
  id                  uuid primary key default uuid_generate_v4(),
  name                text not null,
  description         text,
  location            text not null,
  date                date not null,
  check_in_start     timestamptz not null,
  check_in_late      timestamptz not null,
  check_in_end       timestamptz not null,
  check_out_start    timestamptz,
  check_out_end      timestamptz,
  created_by         uuid not null references public.users(id),
  created_at         timestamptz default now()
);

alter table public.events enable row level security;

-- Nuke and recreate clean policies
do $$ 
declare 
    pol record;
begin 
    for pol in (select policyname from pg_policies where tablename = 'events' and schemaname = 'public') loop
        execute format('drop policy %I on public.events', pol.policyname);
    end loop;
end $$;
create policy "Everyone can view events" on public.events for select using (true);
create policy "Admins can manage events" on public.events for all using (public.is_admin());

-- ============================================================
-- QR SESSIONS (Class or specific activity scanning)
-- ============================================================
create table if not exists public.qr_sessions (
  id                  uuid primary key default uuid_generate_v4(),
  facilitator_id      uuid not null references public.users(id) on delete cascade,
  subject             text not null,
  section             text not null,
  date                date not null,
  expires_at          timestamptz not null,
  code                text not null unique,
  created_at          timestamptz default now()
);

alter table public.qr_sessions enable row level security;

-- Nuke and recreate clean policies
do $$ 
declare 
    pol record;
begin 
    for pol in (select policyname from pg_policies where tablename = 'qr_sessions' and schemaname = 'public') loop
        execute format('drop policy %I on public.qr_sessions', pol.policyname);
    end loop;
end $$;

create policy "Facilitators can create sessions" on public.qr_sessions for insert with check (auth.uid() = facilitator_id AND public.is_council());
create policy "Authenticated users can read sessions" on public.qr_sessions for select using (auth.role() = 'authenticated');
create policy "Admins and creators can manage sessions" on public.qr_sessions for all using (public.is_admin() OR auth.uid() = facilitator_id);

-- ============================================================
-- ATTENDANCE RECORDS (Combined model)
-- ============================================================
create table if not exists public.attendance_records (
  id          uuid primary key default uuid_generate_v4(),
  student_id  uuid not null references public.users(id) on delete cascade,
  event_id    uuid references public.events(id) on delete cascade,   -- For school-wide events
  session_id  uuid references public.qr_sessions(id) on delete cascade, -- For classroom sessions
  
  status      text not null check (status in ('present', 'late', 'absent', 'incomplete')),
  
  time_in     timestamptz,
  time_out    timestamptz,
  
  scanned_by  uuid references public.users(id),
  remarks     text default '',
  created_at  timestamptz default now(),
  
  -- Constraint: an attendance record must be for either an event or a session
  constraint check_attendance_target check (event_id is not null or session_id is not null)
);

alter table public.attendance_records enable row level security;

-- Nuke and recreate clean policies
do $$ 
declare 
    pol record;
begin 
    for pol in (select policyname from pg_policies where tablename = 'attendance_records' and schemaname = 'public') loop
        execute format('drop policy %I on public.attendance_records', pol.policyname);
    end loop;
end $$;

create policy "Students can read their own attendance" on public.attendance_records for select using (auth.uid() = student_id);
create policy "Facilitators and Admins manage attendance" on public.attendance_records for all using (public.is_council());
create policy "Students can insert own attendance for sessions" on public.attendance_records for insert with check (auth.uid() = student_id);

-- ============================================================
-- HELPER VIEWS
-- ============================================================

drop view if exists public.student_attendance_summary;
create or replace view public.student_attendance_summary as
select
  u.id as student_id,
  u.full_name,
  sp.student_id_number,
  sp.section,
  sp.current_year,
  count(*) as total_records,
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

-- ============================================================
-- READY-MADE ADMIN INITIALIZATION
-- ============================================================
-- TO BE RUN MANUALLY: 
-- update public.users set account_type = 'admin', status = 'approved' where email = 'your-admin@email.com';
