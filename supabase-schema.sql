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

-- Trigger to protect users table columns
create or replace function public.protect_user_fields()
returns trigger as $$
begin
  if auth.jwt() ->> 'role' = 'service_role' then
    return new;
  end if;

  if not public.is_admin() then
    if new.account_type is distinct from old.account_type then
      raise exception 'You are not allowed to change your account_type.';
    end if;

    if new.status is distinct from old.status then
      raise exception 'You are not allowed to change your status.';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.protect_user_fields() to authenticated, anon;

-- Student self check-in function
create or replace function public.check_in_student(session_code text)
returns json as $$
declare
  v_session record;
  v_student_id uuid;
  v_status text;
  v_late_threshold text;
  v_now timestamptz;
  v_existing record;
  v_record record;
begin
  v_student_id := auth.uid();
  if v_student_id is null then
    raise exception 'Unauthorized';
  end if;

  select * into v_session
  from public.qr_sessions
  where code = session_code;

  if not found then
    raise exception 'Invalid QR code';
  end if;

  if v_session.expires_at < now() then
    raise exception 'This QR code has expired';
  end if;

  select id into v_existing
  from public.attendance_records
  where student_id = v_student_id and session_id = v_session.id;

  if found then
    raise exception 'Already checked in for this session';
  end if;

  v_now := now();
  v_status := 'present';

  select value into v_late_threshold
  from public.system_config
  where key = 'lateThreshold';

  if v_late_threshold is not null then
    if ((timezone('Asia/Manila', v_now))::time > v_late_threshold::time) then
      v_status := 'late';
    end if;
  end if;

  insert into public.attendance_records (
    student_id,
    session_id,
    status,
    time_in,
    remarks
  ) values (
    v_student_id,
    v_session.id,
    v_status,
    v_now,
    'Self check-in via QR Scan' || case when v_status = 'late' then ' (LATE)' else '' end
  ) returning * into v_record;

  return json_build_object(
    'ok', true,
    'record', row_to_json(v_record)
  );
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.check_in_student(text) to authenticated;

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

create policy "allow_signup" on public.users for insert with check (
  auth.uid() = id 
  and account_type in ('student', 'facilitator') 
  and (
    (account_type = 'student' and status = 'approved') or
    (account_type = 'facilitator' and status = 'pending')
  )
);
create policy "allow_own_read" on public.users for select using (auth.uid() = id);
create policy "allow_own_update" on public.users for update using (auth.uid() = id);
create policy "allow_admin_manage_all" on public.users for all using ((auth.uid() != id) and public.is_admin());

drop trigger if exists trigger_protect_user_fields on public.users;
create trigger trigger_protect_user_fields
  before update on public.users
  for each row
  execute function public.protect_user_fields();

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

drop policy if exists "Students can update their own profile" on public.student_profiles;
create policy "Students can update their own profile" on public.student_profiles for update using (auth.uid() = user_id);

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

drop policy if exists "Facilitators can update their own profile" on public.facilitator_profiles;
create policy "Facilitators can update their own profile" on public.facilitator_profiles for update using (auth.uid() = user_id);

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
create policy "Council can manage events" on public.events for all using (public.is_council());

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
create policy "Authenticated users can read sessions" on public.qr_sessions for select using (
  public.is_council()
  or (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.attendance_records ar
      where ar.session_id = qr_sessions.id and ar.student_id = auth.uid()
    )
  )
);
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
-- Note: Student insertion is now handled exclusively via the secure check_in_student() RPC function.
-- Direct table insertion is blocked for non-council users.

-- ============================================================
-- HELPER VIEWS
-- ============================================================

drop view if exists public.student_attendance_summary;
create or replace view public.student_attendance_summary 
with (security_invoker = true) as
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

-- Secure schedule view for students (excludes the secret code column)
drop view if exists public.student_schedule;
create or replace view public.student_schedule as
select id, facilitator_id, subject, section, date, expires_at, created_at
from public.qr_sessions
where section = (
  select section from public.student_profiles where user_id = auth.uid()
);

grant select on public.student_schedule to authenticated;

-- ============================================================
-- READY-MADE ADMIN INITIALIZATION
-- ============================================================
-- TO BE RUN MANUALLY: 
-- update public.users set account_type = 'admin', status = 'approved' where email = 'your-admin@email.com';
