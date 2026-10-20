-- =============================================================================
-- Stamp Rally schema. Paste this whole file into Supabase -> SQL Editor -> Run.
-- Safe to re-run on an empty project; to start over, run reset.sql first.
--
-- Security model
--   * Participants have no account. Joining a group gives the phone that group's
--     secret join_token; every participant write goes through a SECURITY DEFINER
--     function below that checks it. Tables are read-only to the public.
--   * Secrets (join tokens, join codes, leader PINs, checkpoint QR tokens, quiz
--     answers) live in *_secrets tables that only the admin can read.
--   * The admin is a Supabase Auth user listed in public.admins.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- types -----
create type event_phase as enum
  ('welcome', 'walk', 'grouping', 'briefing', 'rally', 'return', 'gallery', 'closing');
create type checkpoint_method as enum ('photo', 'qr');
create type stamp_method as enum ('photo', 'qr', 'manual');
create type stamp_status as enum ('ok', 'rejected');
create type person_kind as enum ('exco', 'new_committee');

-- --------------------------------------------------------------- admins -----
create table admins (
  user_id uuid primary key references auth.users on delete cascade
);

create function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- event -----
create table event (
  id int primary key default 1 check (id = 1),
  name text not null default 'Flower Dome Stamp Rally',
  club_name text not null default 'Our Club',
  phase event_phase not null default 'welcome',
  welcome_md text not null default '',
  programme_md text not null default '',
  walk_md text not null default '',
  briefing_md text not null default '',
  return_md text not null default '',
  closing_message_md text not null default '',
  meeting_point text not null default '',
  feedback_url text not null default '',
  rally_started_at timestamptz,
  rally_ends_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into event (id) values (1);

-- --------------------------------------------------------------- groups -----
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null default '🌿',
  leader_name text not null default '',
  sort_order int not null default 0,
  finished_at timestamptz,          -- time of the stamp that completed the card
  created_at timestamptz not null default now()
);

create table group_secrets (
  group_id uuid primary key references groups on delete cascade,
  join_code text not null unique,   -- short, typeable: "FERN-27"
  join_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  leader_pin text not null default lpad((floor(random() * 1000000))::int::text, 6, '0')
);

-- ---------------------------------------------------------- checkpoints -----
create table checkpoints (
  id uuid primary key default gen_random_uuid(),
  sort_order int not null default 0,
  name text not null,
  location_hint text not null default '',
  method checkpoint_method not null default 'photo',
  task_prompt text not null default '',   -- e.g. "Take a group photo with the baobab"
  question text,                          -- optional; null = no question
  points int not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table checkpoint_secrets (
  checkpoint_id uuid primary key references checkpoints on delete cascade,
  qr_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  answers text[] not null default '{}'    -- accepted answers, compared normalised
);

-- --------------------------------------------------------------- photos -----
create table photos (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  checkpoint_id uuid references checkpoints on delete set null,
  storage_path text not null unique,
  caption text not null default '',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- stamps -----
create table stamps (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups on delete cascade,
  checkpoint_id uuid not null references checkpoints on delete cascade,
  method stamp_method not null,
  status stamp_status not null default 'ok',
  photo_id uuid references photos on delete set null,
  stamped_at timestamptz not null,       -- effective time, see effective_time()
  client_time timestamptz,
  received_at timestamptz not null default now(),
  question_attempts int not null default 0,
  question_correct boolean,              -- null until answered / out of tries
  points int,                            -- null while a question is outstanding
  rejected_reason text,
  unique (group_id, checkpoint_id)       -- a checkpoint only counts once per group
);

create table question_attempts (
  id uuid primary key,                   -- client-generated, makes retries idempotent
  group_id uuid not null references groups on delete cascade,
  checkpoint_id uuid not null references checkpoints on delete cascade,
  answer text not null,
  correct boolean not null,
  created_at timestamptz not null default now()
);

-- --------------------------------------------------------------- people -----
create table people (
  id uuid primary key default gen_random_uuid(),
  kind person_kind not null,
  name text not null,
  role text not null default '',
  photo_path text,
  sort_order int not null default 0
);

-- ---------------------------------------------- auto-create secret rows -----
create function make_group_secrets() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  words text[] := array['FERN','MOSS','PALM','LILY','IRIS','SAGE','ROSE','OLIVE','LOTUS','ORCHID','CACTUS','BAOBAB'];
  code text;
begin
  loop
    code := words[1 + floor(random() * array_length(words, 1))::int] || '-' || lpad((floor(random() * 100))::int::text, 2, '0');
    exit when not exists (select 1 from group_secrets where join_code = code);
  end loop;
  insert into group_secrets (group_id, join_code) values (new.id, code) on conflict do nothing;
  return new;
end $$;
create trigger groups_secrets after insert on groups
  for each row execute function make_group_secrets();

create function make_checkpoint_secrets() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into checkpoint_secrets (checkpoint_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger checkpoints_secrets after insert on checkpoints
  for each row execute function make_checkpoint_secrets();

-- ------------------------------------------------------------------ RLS -----
alter table admins enable row level security;
alter table event enable row level security;
alter table groups enable row level security;
alter table group_secrets enable row level security;
alter table checkpoints enable row level security;
alter table checkpoint_secrets enable row level security;
alter table photos enable row level security;
alter table stamps enable row level security;
alter table question_attempts enable row level security;
alter table people enable row level security;

-- Public read
create policy "read" on event for select using (true);
create policy "read" on groups for select using (true);
create policy "read" on checkpoints for select using (true);
create policy "read" on stamps for select using (true);
create policy "read" on people for select using (true);
create policy "read" on photos for select using (not hidden or is_admin());

-- Admin full access
create policy "admin" on admins for select using (is_admin());
create policy "admin" on event for all using (is_admin()) with check (is_admin());
create policy "admin" on groups for all using (is_admin()) with check (is_admin());
create policy "admin" on group_secrets for all using (is_admin()) with check (is_admin());
create policy "admin" on checkpoints for all using (is_admin()) with check (is_admin());
create policy "admin" on checkpoint_secrets for all using (is_admin()) with check (is_admin());
create policy "admin" on photos for all using (is_admin()) with check (is_admin());
create policy "admin" on stamps for all using (is_admin()) with check (is_admin());
create policy "admin" on question_attempts for all using (is_admin()) with check (is_admin());
create policy "admin" on people for all using (is_admin()) with check (is_admin());

-- -------------------------------------------------------------- helpers -----

-- Resolve a join token to a group id, or raise.
create function group_from_token(p_token text) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare gid uuid;
begin
  select group_id into gid from group_secrets where join_token = p_token;
  if gid is null then raise exception 'invalid_group' using errcode = 'P0001'; end if;
  return gid;
end $$;

-- Stamps queued offline are submitted late. Use the phone's clock for the
-- stamp time, but clamp it between rally start and the moment the server
-- received it, so a wrong or tampered phone clock can't gain an advantage.
create function effective_time(p_client timestamptz) returns timestamptz
language sql stable security definer set search_path = public as $$
  select greatest(
    coalesce((select rally_started_at from event where id = 1), now() - interval '12 hours'),
    least(coalesce(p_client, now()), now())
  );
$$;

-- 'Kew Gardens!' -> 'kew gardens'
create function normalise_answer(p text) returns text
language sql immutable as $$
  select trim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'));
$$;

-- Points a stamp is worth given the question state.
create function stamp_points(p_checkpoint uuid, p_correct boolean, p_attempts int) returns int
language sql stable security definer set search_path = public as $$
  select case
    when c.question is null or c.question = '' then c.points
    when p_correct then c.points
    when p_attempts >= 3 then 0
    else null
  end
  from checkpoints c where c.id = p_checkpoint;
$$;

-- Set or clear groups.finished_at after any stamp change.
create function refresh_group_finish(p_group uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  needed int;
  have int;
  last_at timestamptz;
begin
  select count(*) into needed from checkpoints where active;
  select count(*), max(s.stamped_at) into have, last_at
    from stamps s join checkpoints c on c.id = s.checkpoint_id
    where s.group_id = p_group and s.status = 'ok' and c.active;
  update groups set finished_at = case when needed > 0 and have >= needed then last_at end
    where id = p_group;
end $$;

-- Insert a stamp, or revive a rejected one.
-- Returns 'stamped' | 'already' | 'not_started' | 'too_late'.
create function put_stamp(p_group uuid, p_checkpoint uuid, p_method stamp_method,
                          p_client timestamptz, p_photo uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  t timestamptz := effective_time(p_client);
  started timestamptz;
  ends timestamptz;
  existing stamps%rowtype;
begin
  select rally_started_at, rally_ends_at into started, ends from event where id = 1;
  -- Leaders can always stamp manually (e.g. to fix a dispute after time).
  if p_method <> 'manual' then
    if started is null then return 'not_started'; end if;
    if ends is not null and t > ends then return 'too_late'; end if;
  end if;

  select * into existing from stamps where group_id = p_group and checkpoint_id = p_checkpoint for update;
  if found and existing.status = 'ok' then
    return 'already';
  end if;

  if found then
    update stamps set method = p_method, status = 'ok', photo_id = p_photo, stamped_at = t,
                      client_time = p_client, received_at = now(), rejected_reason = null
      where id = existing.id;
  else
    insert into stamps (group_id, checkpoint_id, method, photo_id, stamped_at, client_time, points)
      values (p_group, p_checkpoint, p_method, p_photo, t, p_client,
              stamp_points(p_checkpoint, null, 0));
  end if;

  perform refresh_group_finish(p_group);
  return 'stamped';
end $$;

-- ------------------------------------------------------ participant API -----

-- Join by short code ("fern 27") or by the long token in a group QR.
create function join_group(p_code text) returns json
language plpgsql security definer set search_path = public as $$
declare
  s group_secrets%rowtype;
  g groups%rowtype;
  norm text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  select * into s from group_secrets
    where join_token = p_code
       or upper(replace(join_code, '-', '')) = norm
    limit 1;
  if not found then
    return json_build_object('status', 'invalid');
  end if;
  select * into g from groups where id = s.group_id;
  return json_build_object('status', 'ok', 'group_id', g.id, 'join_token', s.join_token,
                           'name', g.name, 'emoji', g.emoji, 'leader_name', g.leader_name);
end $$;

-- Scan a checkpoint QR.
create function claim_qr_stamp(p_group_token text, p_qr_token text, p_client_time timestamptz)
returns json
language plpgsql security definer set search_path = public as $$
declare
  gid uuid := group_from_token(p_group_token);
  cp checkpoints%rowtype;
  result text;
begin
  select c.* into cp from checkpoints c join checkpoint_secrets s on s.checkpoint_id = c.id
    where s.qr_token = p_qr_token;
  if not found or not cp.active then
    return json_build_object('status', 'invalid');
  end if;
  if cp.method <> 'qr' then
    return json_build_object('status', 'wrong_method', 'checkpoint_id', cp.id, 'name', cp.name);
  end if;
  result := put_stamp(gid, cp.id, 'qr', p_client_time, null);
  return json_build_object('status', result, 'checkpoint_id', cp.id, 'name', cp.name);
end $$;

-- Record a photo that has already been uploaded to storage at
-- photos/<group_id>/<file>. If p_checkpoint_id is a photo checkpoint the
-- photo also earns that stamp; otherwise it is just added to the gallery.
create function submit_photo(p_group_token text, p_checkpoint_id uuid, p_storage_path text,
                             p_caption text, p_client_time timestamptz)
returns json
language plpgsql security definer set search_path = public as $$
declare
  gid uuid := group_from_token(p_group_token);
  cp checkpoints%rowtype;
  pid uuid;
  result text := 'saved';
begin
  if p_storage_path not like gid::text || '/%' then
    raise exception 'bad_path' using errcode = 'P0001';
  end if;

  insert into photos (group_id, checkpoint_id, storage_path, caption)
    values (gid, p_checkpoint_id, p_storage_path, coalesce(p_caption, ''))
    on conflict (storage_path) do nothing
    returning id into pid;
  if pid is null then
    select id into pid from photos where storage_path = p_storage_path;
  end if;

  if p_checkpoint_id is not null then
    select * into cp from checkpoints where id = p_checkpoint_id;
    if found and cp.active and cp.method = 'photo' then
      result := put_stamp(gid, cp.id, 'photo', p_client_time, pid);
    end if;
  end if;

  return json_build_object('status', result, 'photo_id', pid, 'checkpoint_id', p_checkpoint_id);
end $$;

create function verify_leader_pin(p_group_token text, p_pin text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_secrets where join_token = p_group_token and leader_pin = trim(p_pin));
$$;

-- EXCO leader fallback when a QR won't scan or a photo won't upload.
create function leader_stamp(p_group_token text, p_pin text, p_checkpoint_id uuid,
                             p_client_time timestamptz)
returns json
language plpgsql security definer set search_path = public as $$
declare
  gid uuid := group_from_token(p_group_token);
  result text;
begin
  if not verify_leader_pin(p_group_token, p_pin) then
    return json_build_object('status', 'bad_pin');
  end if;
  if not exists (select 1 from checkpoints where id = p_checkpoint_id and active) then
    return json_build_object('status', 'invalid');
  end if;
  result := put_stamp(gid, p_checkpoint_id, 'manual', p_client_time, null);
  return json_build_object('status', result, 'checkpoint_id', p_checkpoint_id);
end $$;

-- Answer a checkpoint question. Needs the stamp first. 3 tries; after that the
-- stamp still counts but scores 0. p_attempt_id makes retries idempotent.
create function answer_question(p_group_token text, p_checkpoint_id uuid, p_answer text,
                                p_attempt_id uuid)
returns json
language plpgsql security definer set search_path = public as $$
declare
  gid uuid := group_from_token(p_group_token);
  st stamps%rowtype;
  ok boolean;
  n int;
begin
  select * into st from stamps where group_id = gid and checkpoint_id = p_checkpoint_id for update;
  if not found then
    return json_build_object('status', 'no_stamp');
  end if;

  if st.question_correct is null and st.question_attempts < 3
     and not exists (select 1 from question_attempts where id = p_attempt_id) then
    select exists (
      select 1 from checkpoint_secrets s, unnest(s.answers) a
      where s.checkpoint_id = p_checkpoint_id and normalise_answer(a) = normalise_answer(p_answer)
    ) into ok;
    insert into question_attempts (id, group_id, checkpoint_id, answer, correct)
      values (p_attempt_id, gid, p_checkpoint_id, p_answer, ok);
    select count(*) into n from question_attempts where group_id = gid and checkpoint_id = p_checkpoint_id;
    update stamps set
      question_attempts = n,
      question_correct = case when ok then true when n >= 3 then false end,
      points = stamp_points(p_checkpoint_id, case when ok then true end, n)
    where id = st.id
    returning * into st;
  end if;

  return json_build_object(
    'status', case when st.question_correct then 'correct'
                   when st.question_correct = false then 'out_of_tries'
                   else 'wrong' end,
    'attempts', st.question_attempts,
    'points', st.points);
end $$;

-- ------------------------------------------------------------ admin API -----
create function admin_reject_stamp(p_stamp_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  update stamps set status = 'rejected', rejected_reason = nullif(trim(p_reason), '')
    where id = p_stamp_id returning group_id into gid;
  if gid is not null then perform refresh_group_finish(gid); end if;
end $$;

create function admin_restore_stamp(p_stamp_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if not is_admin() then raise exception 'not_admin'; end if;
  update stamps set status = 'ok', rejected_reason = null
    where id = p_stamp_id returning group_id into gid;
  if gid is not null then perform refresh_group_finish(gid); end if;
end $$;

-- Lock down: helper functions are internal only.
revoke execute on function group_from_token(text) from public, anon, authenticated;
revoke execute on function put_stamp(uuid, uuid, stamp_method, timestamptz, uuid) from public, anon, authenticated;
revoke execute on function refresh_group_finish(uuid) from public, anon, authenticated;
revoke execute on function effective_time(timestamptz) from public, anon, authenticated;
revoke execute on function stamp_points(uuid, boolean, int) from public, anon, authenticated;

-- ------------------------------------------------------------- realtime -----
alter publication supabase_realtime add table event, groups, checkpoints, stamps, photos, people;

-- -------------------------------------------------------------- storage -----
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Anyone may upload a new photo (no overwrite, no delete); the bucket's size
-- and type limits apply. Photos only reach the gallery via submit_photo().
create policy "photos upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'photos');
create policy "photos admin" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and public.is_admin())
  with check (bucket_id = 'photos' and public.is_admin());
