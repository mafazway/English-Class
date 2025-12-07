


import { createClient } from '@supabase/supabase-js'
import { CloudConfig } from '../types';

export const checkConnection = async (config: CloudConfig): Promise<boolean> => {
  if (!config.url || !config.key) return false;
  try {
    const supabase = createClient(config.url, config.key);
    const { data, error } = await supabase.from('students').select('id').limit(1);
    // Code PGRST116 is "JSON object requested, multiple (or no) rows returned" - which means connection worked but table empty
    if (!error || error.code === 'PGRST116') return true;
    console.error("Supabase Connection Error:", error.message);
    return false;
  } catch (e) {
    console.error("Connection exception:", e);
    return false;
  }
};

export const getSetupSQL = () => `
-- REPAIR SCRIPT: Fix Missing Columns & Types & Permissions
-- Run this in Supabase SQL Editor to fix "Save Errors"

-- 1. STUDENTS
create table if not exists students (
  id text primary key,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table students alter column id type text;
alter table students add column if not exists admission_number text;
alter table students add column if not exists parent_name text;
alter table students add column if not exists mobile_number text;
alter table students add column if not exists whatsapp_number text;
alter table students add column if not exists grade text;
alter table students add column if not exists gender text;
alter table students add column if not exists notes text;
alter table students add column if not exists joined_date text;
alter table students add column if not exists photo text;
alter table students add column if not exists last_reminder_sent_at text;
alter table students add column if not exists reminder_count numeric;
alter table students add column if not exists last_inquiry_sent_date text;

alter table students enable row level security;
drop policy if exists "Public Access Students" on students;
create policy "Public Access Students" on students for all using (true) with check (true);
grant all on table students to anon;
grant all on table students to authenticated;
grant all on table students to service_role;

-- 2. CLASSES
create table if not exists classes (
  id text primary key,
  name text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table classes alter column id type text;
alter table classes add column if not exists schedule text;
alter table classes add column if not exists day text;
alter table classes add column if not exists start_time text;

alter table classes enable row level security;
drop policy if exists "Public Access Classes" on classes;
create policy "Public Access Classes" on classes for all using (true) with check (true);
grant all on table classes to anon;
grant all on table classes to authenticated;
grant all on table classes to service_role;

-- 3. ATTENDANCE
create table if not exists attendance (
  id text primary key,
  class_id text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table attendance alter column id type text;
alter table attendance alter column class_id type text;
alter table attendance add column if not exists date text;
alter table attendance add column if not exists student_ids_present text[];
alter table attendance add column if not exists contacted_absentees text[];
alter table attendance add column if not exists status text;

alter table attendance enable row level security;
drop policy if exists "Public Access Attendance" on attendance;
create policy "Public Access Attendance" on attendance for all using (true) with check (true);
grant all on table attendance to anon;
grant all on table attendance to authenticated;
grant all on table attendance to service_role;

-- 4. FEES
create table if not exists fees (
  id text primary key,
  student_id text,
  amount numeric,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table fees alter column id type text;
alter table fees alter column student_id type text;
alter table fees add column if not exists paid_date text;
alter table fees add column if not exists notes text;
alter table fees add column if not exists receipt_sent boolean;
alter table fees add column if not exists billing_month text;
alter table fees add column if not exists next_due_date text;

alter table fees enable row level security;
drop policy if exists "Public Access Fees" on fees;
create policy "Public Access Fees" on fees for all using (true) with check (true);
grant all on table fees to anon;
grant all on table fees to authenticated;
grant all on table fees to service_role;

-- 5. EXAMS
create table if not exists exams (
  id text primary key,
  student_id text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table exams alter column id type text;
alter table exams alter column student_id type text;
alter table exams add column if not exists subject text;
alter table exams add column if not exists marks numeric;
alter table exams add column if not exists total numeric;
alter table exams add column if not exists exam_date text;

alter table exams enable row level security;
drop policy if exists "Public Access Exams" on exams;
create policy "Public Access Exams" on exams for all using (true) with check (true);
grant all on table exams to anon;
grant all on table exams to authenticated;
grant all on table exams to service_role;
`;