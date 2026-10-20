-- ============================================================================
-- Postcards from Singapore: one-time database setup
--
-- Paste this whole file into Supabase > SQL Editor > New query, and click Run.
-- It is safe to run again (it won't duplicate anything).
--
-- After it runs, scroll to the bottom section "YOUR EVENT" and follow the steps.
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) between 3 and 20),
  name text not null default 'Postcards from Singapore',
  event_date date not null,
  seasonal_title text not null default 'All aboard the MRT',
  seasonal_stamp_text text not null default E'ALL ABOARD\nTHE MRT',
  seasonal_prompt text not null default E'Find the SMRT trains and reimagined MRT stations in the Christmas Train Show and take a photo with them.\nWhich real MRT station does it remind you of, and what''s your favourite stop or memory on that line?\nNew to Singapore? Tell us which station you''ve used most since arriving, or the one you most want to visit.',
  created_at timestamptz not null default now()
);

-- Kept apart from `events` so the passcode hash can never be read by the website.
create table if not exists public.event_secrets (
  event_id uuid primary key references public.events (id) on delete cascade,
  admin_passcode_hash text not null
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  student_id text not null check (student_id ~ '^\d{7}$'),
  first_name text not null check (length(first_name) between 1 and 30),
  name_key text not null,
  country text not null check (length(country) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (event_id, student_id)
);

-- Which browser (Supabase anonymous login) is currently logged in as which student.
create table if not exists public.devices (
  user_id uuid primary key references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  linked_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  stamp_key text not null check (stamp_key in ('flower_home', 'this_is_sg', 'swap_story', 'bridge', 'seasonal')),
  photo_path text not null,
  reflection text not null check (length(reflection) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, stamp_key)
);

create table if not exists public.postcards (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  submission_id uuid references public.submissions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.flowers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  student_id uuid not null unique references public.students (id) on delete cascade,
  image_path text not null,
  flower_name text not null check (length(flower_name) between 1 and 40),
  meaning text not null check (length(meaning) between 1 and 200),
  -- Copied from the student by a trigger, so the garden never needs to read student records.
  first_name text not null default '',
  country text not null default '',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  primary key (user_id, event_id)
);

create index if not exists students_event_idx on public.students (event_id);
create index if not exists devices_student_idx on public.devices (student_id);
create index if not exists flowers_event_idx on public.flowers (event_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.name_key(p_name text)
returns text language sql immutable set search_path = '' as $$
  select lower(regexp_replace(btrim(extensions.unaccent(p_name)), '\s+', ' ', 'g'))
$$;

-- Students this browser is logged in as (at most one).
create or replace function public.my_student_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select student_id from public.devices where user_id = auth.uid()
$$;

create or replace function public.is_admin(p_event_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and event_id = p_event_id)
$$;

-- Storage paths start with the event id; this checks it without students needing access to `admins`.
create or replace function public.is_admin_for_folder(p_folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and event_id::text = p_folder)
$$;

create or replace function public.flowers_fill_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select s.first_name, s.country, s.event_id into new.first_name, new.country, new.event_id
  from public.students s where s.id = new.student_id;
  return new;
end $$;

drop trigger if exists flowers_fill_owner on public.flowers;
create trigger flowers_fill_owner before insert or update of student_id on public.flowers
  for each row execute function public.flowers_fill_owner();

-- ---------------------------------------------------------------------------
-- Student login: student ID + first name. Rejoining on a new phone with the
-- same student ID and first name links that phone to the existing passport.
-- ---------------------------------------------------------------------------

create or replace function public.join_event(p_event_code text, p_student_id text, p_first_name text, p_country text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_event public.events;
  v_student public.students;
  v_rejoined boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_event from public.events where code = upper(btrim(p_event_code));
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'bad_event');
  end if;

  select * into v_student from public.students
  where event_id = v_event.id and student_id = btrim(p_student_id);

  if found then
    if v_student.name_key <> public.name_key(p_first_name) then
      return jsonb_build_object('ok', false, 'reason', 'name_mismatch');
    end if;
    v_rejoined := true;
  else
    insert into public.students (event_id, student_id, first_name, name_key, country)
    values (
      v_event.id,
      btrim(p_student_id),
      left(regexp_replace(btrim(p_first_name), '\s+', ' ', 'g'), 30),
      public.name_key(p_first_name),
      left(btrim(p_country), 40)
    )
    returning * into v_student;
  end if;

  insert into public.devices (user_id, student_id) values (auth.uid(), v_student.id)
  on conflict (user_id) do update set student_id = excluded.student_id, linked_at = now();

  return jsonb_build_object(
    'ok', true,
    'rejoined', v_rejoined,
    'event', jsonb_build_object(
      'id', v_event.id, 'code', v_event.code, 'name', v_event.name, 'eventDate', v_event.event_date,
      'seasonalTitle', v_event.seasonal_title, 'seasonalStampText', v_event.seasonal_stamp_text,
      'seasonalPrompt', v_event.seasonal_prompt
    ),
    'student', jsonb_build_object(
      'id', v_student.id, 'eventId', v_student.event_id, 'studentId', v_student.student_id,
      'firstName', v_student.first_name, 'country', v_student.country
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Organiser admin (passcode checked here, never in the website)
-- ---------------------------------------------------------------------------

create or replace function public.admin_login(p_event_code text, p_passcode text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select e.id into v_event_id
  from public.events e join public.event_secrets s on s.event_id = e.id
  where e.code = upper(btrim(p_event_code))
    and s.admin_passcode_hash = extensions.crypt(p_passcode, s.admin_passcode_hash);
  if v_event_id is null then
    return null;
  end if;
  insert into public.admins (user_id, event_id) values (auth.uid(), v_event_id) on conflict do nothing;
  return v_event_id;
end $$;

create or replace function public.admin_progress(p_event_id uuid)
returns table (
  student_row_id uuid, student_id text, first_name text, country text, stamps int,
  postcard_made boolean, flower_id uuid, flower_name text, flower_hidden boolean, joined_at timestamptz
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin(p_event_id) then
    raise exception 'not an organiser';
  end if;
  return query
  select s.id, s.student_id, s.first_name, s.country,
    (select count(*)::int from public.submissions x where x.student_id = s.id),
    exists (select 1 from public.postcards p where p.student_id = s.id),
    f.id, f.flower_name, f.hidden, s.created_at
  from public.students s
  left join public.flowers f on f.student_id = s.id
  where s.event_id = p_event_id
  order by s.created_at;
end $$;

create or replace function public.admin_set_flower_hidden(p_flower_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.flowers set hidden = p_hidden
  where id = p_flower_id and public.is_admin(event_id);
  if not found then
    raise exception 'not allowed';
  end if;
end $$;

-- Deletes every student, stamp, postcard record and flower for the event (photos are
-- removed from Storage by the admin page just before this runs), plus the anonymous
-- logins used by students. The event itself and organiser access are kept.
create or replace function public.admin_delete_event_data(p_event_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin(p_event_id) then
    raise exception 'not an organiser';
  end if;
  begin
    delete from auth.users u
    where u.is_anonymous
      and u.id in (select d.user_id from public.devices d join public.students s on s.id = d.student_id where s.event_id = p_event_id)
      and u.id not in (select a.user_id from public.admins a);
  exception when insufficient_privilege then
    null; -- Anonymous logins hold no personal data; skip if not permitted.
  end;
  delete from public.students where event_id = p_event_id;
end $$;

-- Run by organisers in the SQL Editor only (see the bottom of this file).
create or replace function public.set_admin_passcode(p_event_code text, p_passcode text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_event_id uuid;
begin
  if length(p_passcode) < 12 then
    raise exception 'Please use a passcode of at least 12 characters.';
  end if;
  select id into v_event_id from public.events where code = upper(btrim(p_event_code));
  if v_event_id is null then
    raise exception 'No event with code %', p_event_code;
  end if;
  insert into public.event_secrets (event_id, admin_passcode_hash)
  values (v_event_id, extensions.crypt(p_passcode, extensions.gen_salt('bf')))
  on conflict (event_id) do update set admin_passcode_hash = excluded.admin_passcode_hash;
  -- Changing the passcode logs out every organiser browser.
  delete from public.admins where event_id = v_event_id;
end $$;

revoke all on function public.set_admin_passcode(text, text) from public, anon, authenticated;
revoke all on function public.flowers_fill_owner() from public, anon, authenticated;
grant execute on function public.join_event(text, text, text, text) to authenticated;
grant execute on function public.admin_login(text, text) to authenticated;
grant execute on function public.admin_progress(uuid) to authenticated;
grant execute on function public.admin_set_flower_hidden(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_event_data(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: students only see their own data; the garden only sees
-- flowers that aren't hidden.
-- ---------------------------------------------------------------------------

alter table public.events enable row level security;
alter table public.event_secrets enable row level security;
alter table public.students enable row level security;
alter table public.devices enable row level security;
alter table public.submissions enable row level security;
alter table public.postcards enable row level security;
alter table public.flowers enable row level security;
alter table public.admins enable row level security;

drop policy if exists "events are public" on public.events;
create policy "events are public" on public.events for select to anon, authenticated using (true);

drop policy if exists "own student record" on public.students;
create policy "own student record" on public.students for select to authenticated
  using (id in (select public.my_student_ids()) or public.is_admin(event_id));

drop policy if exists "own submissions read" on public.submissions;
create policy "own submissions read" on public.submissions for select to authenticated
  using (student_id in (select public.my_student_ids()));
drop policy if exists "own submissions insert" on public.submissions;
create policy "own submissions insert" on public.submissions for insert to authenticated
  with check (student_id in (select public.my_student_ids()));
drop policy if exists "own submissions update" on public.submissions;
create policy "own submissions update" on public.submissions for update to authenticated
  using (student_id in (select public.my_student_ids()))
  with check (student_id in (select public.my_student_ids()));

drop policy if exists "own postcards" on public.postcards;
create policy "own postcards" on public.postcards for all to authenticated
  using (student_id in (select public.my_student_ids()))
  with check (student_id in (select public.my_student_ids()));

drop policy if exists "garden reads visible flowers" on public.flowers;
create policy "garden reads visible flowers" on public.flowers for select to anon, authenticated
  using (not hidden or student_id in (select public.my_student_ids()) or public.is_admin(event_id));
drop policy if exists "own flower insert" on public.flowers;
create policy "own flower insert" on public.flowers for insert to authenticated
  with check (student_id in (select public.my_student_ids()) and not hidden);
drop policy if exists "own flower update" on public.flowers;
create policy "own flower update" on public.flowers for update to authenticated
  using (student_id in (select public.my_student_ids()))
  with check (student_id in (select public.my_student_ids()));

-- Students may only change these flower columns (not `hidden`, name or country).
revoke insert, update on public.flowers from anon, authenticated;
grant insert (id, student_id, image_path, flower_name, meaning) on public.flowers to authenticated;
grant update (image_path, flower_name, meaning) on public.flowers to authenticated;

-- No direct access at all; only through the functions above.
revoke all on public.event_secrets from anon, authenticated;
revoke all on public.admins from anon, authenticated;
revoke all on public.devices from anon, authenticated;
revoke insert, update, delete on public.students from anon, authenticated;
revoke insert, update, delete on public.events from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private stamp photos, public flower drawings.
-- Paths are <event id>/<student row id>/<file>.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 5242880, array['image/jpeg']),
  ('flowers', 'flowers', true, 3145728, array['image/png'])
on conflict (id) do nothing;

drop policy if exists "students manage own photos" on storage.objects;
create policy "students manage own photos" on storage.objects for all to authenticated
  using (bucket_id in ('photos', 'flowers') and (storage.foldername(name))[2] in (select id::text from public.my_student_ids() as id))
  with check (bucket_id in ('photos', 'flowers') and (storage.foldername(name))[2] in (select id::text from public.my_student_ids() as id));

drop policy if exists "organisers manage event files" on storage.objects;
create policy "organisers manage event files" on storage.objects for all to authenticated
  using (bucket_id in ('photos', 'flowers') and public.is_admin_for_folder((storage.foldername(name))[1]));

-- ============================================================================
-- YOUR EVENT
--
-- 1. Edit the code and date in the line below if needed, then select just that
--    line and click Run (or leave it: running the whole file creates it too).
--    The event code goes on the QR code; the date is printed on postcards.
-- ============================================================================

insert into public.events (code, name, event_date)
values ('GBTB26', 'Postcards from Singapore', '2026-11-28')
on conflict (code) do nothing;

-- 2. Set the organiser passcode. Replace the text in quotes with a long passcode
--    (at least 12 characters; a short sentence is ideal), select ONLY the line
--    below, remove the two dashes at its start, and click Run. Don't save the
--    query with the passcode in it.
--
-- select public.set_admin_passcode('GBTB26', 'replace with a long passcode');
