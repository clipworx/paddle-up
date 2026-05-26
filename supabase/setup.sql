-- ============================================================
--  Paddle Up — complete database setup
--  Run this once on a fresh Supabase project.
--  Safe to re-run: every statement is idempotent.
-- ============================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
--  TABLES
-- ─────────────────────────────────────────────────────────────

-- Sessions (open-play rotation state)
create table if not exists public.sessions (
  id            text        primary key,
  code          text,
  state         jsonb       not null default '{}'::jsonb,
  password_hash text        not null,
  updated_at    timestamptz not null default now()
);

alter table public.sessions add column if not exists code text;
update public.sessions set code = id where code is null;
create unique index if not exists sessions_code_key on public.sessions (code);

alter table public.sessions enable row level security;
drop   policy if exists "sessions readable" on public.sessions;
create policy "sessions readable" on public.sessions
  for select to anon, authenticated using (true);

-- Locations (facilities that own courts)
create table if not exists public.locations (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  address     text,
  description text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

alter table public.locations enable row level security;
drop   policy if exists "locations readable" on public.locations;
create policy "locations readable" on public.locations
  for select to anon, authenticated using (true);

-- Idempotent: add pricing columns if the table pre-dated 0011.
alter table public.locations
  add column if not exists day_rate           numeric(8,2) not null default 0,
  add column if not exists night_rate         numeric(8,2) not null default 0,
  add column if not exists night_start_time   time         not null default '18:00:00';

-- Idempotent: add operating hours if the table pre-dated 0012.
alter table public.locations
  add column if not exists open_hour  smallint not null default 0
    check (open_hour between 0 and 23),
  add column if not exists close_hour smallint not null default 24
    check (close_hour between 1 and 24);

-- Idempotent: add weekend schedule if the table pre-dated 0013.
alter table public.locations
  add column if not exists weekend_open_hour        smallint not null default 0
    check (weekend_open_hour between 0 and 23),
  add column if not exists weekend_close_hour       smallint not null default 24
    check (weekend_close_hour between 1 and 24),
  add column if not exists weekend_night_start_time time     not null default '18:00:00';

-- Idempotent: add payment fields if the table pre-dated 0014.
alter table public.locations
  add column if not exists payment_qr_url         text,
  add column if not exists payment_account_name   text,
  add column if not exists payment_account_number text;

-- Courts (belong to a location)
create table if not exists public.courts (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  is_active   boolean     not null default true,
  location_id uuid        not null references public.locations(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.courts enable row level security;
drop   policy if exists "courts readable" on public.courts;
create policy "courts readable" on public.courts
  for select to anon, authenticated using (true);

-- Bookings (per court, date, time slot)
create table if not exists public.bookings (
  id           uuid        primary key default gen_random_uuid(),
  court_id     uuid        not null references public.courts(id) on delete cascade,
  date         date        not null,
  start_time   time        not null,
  end_time     time        not null,
  booker_name  text        not null,
  booker_email text        not null,
  player_count int         not null default 4
    check (player_count between 2 and 4),
  notes        text,
  status       text        not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'pending_payment')),
  created_at   timestamptz not null default now()
);

alter table public.bookings enable row level security;
drop   policy if exists "bookings readable"   on public.bookings;
drop   policy if exists "bookings insertable" on public.bookings;
create policy "bookings readable" on public.bookings
  for select to anon, authenticated using (true);
create policy "bookings insertable" on public.bookings
  for insert to anon, authenticated with check (true);

-- Prevent double-booking the same court slot (confirmed + pending both hold the slot)
create unique index if not exists bookings_no_overlap
  on public.bookings (court_id, date, start_time)
  where status in ('confirmed', 'pending_payment');

-- Admins (super admin + location admins)
create table if not exists public.admins (
  id            uuid        primary key default gen_random_uuid(),
  username      text        unique not null,
  password_hash text        not null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

-- Idempotent: add role + location columns if the table pre-dated 0009.
alter table public.admins
  add column if not exists role text not null default 'admin'
    check (role in ('admin', 'location_admin'));
alter table public.admins
  add column if not exists location_id uuid
    references public.locations(id) on delete set null;
alter table public.admins
  add column if not exists email text;

alter table public.admins enable row level security;
-- No select policies: all access goes through service_role RPCs.

alter table public.admins
  drop constraint if exists location_admin_needs_location;
alter table public.admins
  add constraint location_admin_needs_location
    check (role != 'location_admin' or location_id is not null);

-- ─────────────────────────────────────────────────────────────
--  REALTIME
-- ─────────────────────────────────────────────────────────────

alter table public.sessions replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename  = 'sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.sessions';
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────
--  SESSION RPCs  (public access)
-- ─────────────────────────────────────────────────────────────

create or replace function public.create_session(p_password text)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  attempts int := 0;
  idx      int;
begin
  if p_password is null or length(p_password) < 1 then
    raise exception 'password_required';
  end if;
  loop
    new_code := '';
    for idx in 1..6 loop
      new_code := new_code ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.sessions (id, code, state, password_hash)
      values (
        gen_random_uuid()::text, new_code,
        '{"players":[],"courtCount":1,"pending":null,"upcoming":[],"history":[]}'::jsonb,
        crypt(p_password, gen_salt('bf'))
      );
      return new_code;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 10 then raise exception 'failed_to_generate_unique_code'; end if;
    end;
  end loop;
end;
$$;

create or replace function public.verify_session_password(
  p_session_id text, p_password text
) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where id = p_session_id;
  if stored_hash is null then return false; end if;
  return crypt(p_password, stored_hash) = stored_hash;
end;
$$;

create or replace function public.update_session(
  p_session_id text, p_password text, p_new_state jsonb
) returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where id = p_session_id;
  if stored_hash is null then raise exception 'session_not_found'; end if;
  if crypt(p_password, stored_hash) <> stored_hash then raise exception 'invalid_password'; end if;
  update public.sessions set state = p_new_state, updated_at = now() where id = p_session_id;
end;
$$;

create or replace function public.verify_session_password_by_code(
  p_code text, p_password text
) returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where code = p_code;
  if stored_hash is null then return false; end if;
  return crypt(p_password, stored_hash) = stored_hash;
end;
$$;

create or replace function public.update_session_by_code(
  p_code text, p_password text, p_new_state jsonb
) returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where code = p_code;
  if stored_hash is null then raise exception 'session_not_found'; end if;
  if crypt(p_password, stored_hash) <> stored_hash then raise exception 'invalid_password'; end if;
  update public.sessions set state = p_new_state, updated_at = now() where code = p_code;
end;
$$;

create or replace function public.delete_session_by_code(
  p_code text, p_password text
) returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where code = p_code;
  if stored_hash is null then raise exception 'session_not_found'; end if;
  if crypt(p_password, stored_hash) <> stored_hash then raise exception 'invalid_password'; end if;
  delete from public.sessions where code = p_code;
end;
$$;

grant execute on function public.create_session(text)                         to anon, authenticated;
grant execute on function public.verify_session_password(text, text)          to anon, authenticated;
grant execute on function public.update_session(text, text, jsonb)            to anon, authenticated;
grant execute on function public.verify_session_password_by_code(text, text)  to anon, authenticated;
grant execute on function public.update_session_by_code(text, text, jsonb)    to anon, authenticated;
grant execute on function public.delete_session_by_code(text, text)           to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
--  ADMIN RPCs  (service_role only)
-- ─────────────────────────────────────────────────────────────

-- Verify admin password → returns { id, role, location_id } or null
-- Drop first: return type changed from uuid (pre-0009) to jsonb.
drop function if exists public.verify_admin_password(text, text);
create or replace function public.verify_admin_password(
  p_username text, p_password text
) returns jsonb
language plpgsql security definer set search_path = public, extensions
as $$
declare
  stored_hash    text;
  admin_id       uuid;
  admin_role     text;
  admin_location uuid;
begin
  select id, password_hash, role, location_id
    into admin_id, stored_hash, admin_role, admin_location
    from public.admins where username = p_username;
  if stored_hash is null then return null; end if;
  if crypt(p_password, stored_hash) <> stored_hash then return null; end if;
  update public.admins set last_login_at = now() where id = admin_id;
  return jsonb_build_object(
    'id',          admin_id,
    'role',        admin_role,
    'location_id', admin_location
  );
end;
$$;

-- Create or update a super-admin account
create or replace function public.upsert_admin(
  p_username text, p_password text
) returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare admin_id uuid;
begin
  insert into public.admins (username, password_hash, role)
  values (p_username, crypt(p_password, gen_salt('bf')), 'admin')
  on conflict (username) do update set password_hash = excluded.password_hash
  returning id into admin_id;
  return admin_id;
end;
$$;

-- Create a location admin account
create or replace function public.admin_create_location_admin(
  p_username text, p_password text, p_location_id uuid
) returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare new_id uuid;
begin
  insert into public.admins (username, password_hash, role, location_id)
  values (trim(p_username), crypt(p_password, gen_salt('bf')), 'location_admin', p_location_id)
  returning id into new_id;
  return new_id;
end;
$$;

-- List all admins with location name
create or replace function public.admin_list_admins()
returns table (
  id            uuid,
  username      text,
  role          text,
  location_id   uuid,
  location_name text,
  email         text,
  created_at    timestamptz,
  last_login_at timestamptz
)
language sql security definer set search_path = public
as $$
  select a.id, a.username, a.role, a.location_id, l.name,
         a.email, a.created_at, a.last_login_at
    from public.admins a
    left join public.locations l on l.id = a.location_id
   order by a.role, a.username;
$$;

-- Create a new super-admin account (fails if username already taken)
create or replace function public.admin_create_admin(
  p_username text,
  p_password text
) returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare new_id uuid;
begin
  insert into public.admins (username, password_hash, role)
  values (trim(p_username), crypt(p_password, gen_salt('bf')), 'admin')
  returning id into new_id;
  return new_id;
end;
$$;

-- Delete an admin account
create or replace function public.admin_delete_admin(p_admin_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.admins where id = p_admin_id;
end;
$$;

-- Delete a session by code (admin override, no password required)
create or replace function public.admin_delete_session_by_code(p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  delete from public.sessions where code = upper(trim(p_code));
  if not found then raise exception 'session_not_found'; end if;
end;
$$;

-- Reset a session's edit password (admin override)
create or replace function public.admin_set_session_password_by_code(
  p_code text, p_new_password text
) returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  update public.sessions
     set password_hash = crypt(p_new_password, gen_salt('bf')),
         updated_at    = now()
   where code = upper(trim(p_code));
  if not found then raise exception 'session_not_found'; end if;
end;
$$;

-- Create a location + N courts in one shot
create or replace function public.admin_create_location(
  p_name text, p_address text, p_description text, p_court_count int
) returns uuid
language plpgsql security definer set search_path = public, extensions
as $$
declare
  loc_id uuid;
  i      int;
begin
  if p_court_count < 1 or p_court_count > 16 then
    raise exception 'court_count_out_of_range';
  end if;
  insert into public.locations (name, address, description)
  values (
    trim(p_name),
    nullif(trim(p_address), ''),
    nullif(trim(p_description), '')
  )
  returning id into loc_id;
  for i in 1..p_court_count loop
    insert into public.courts (name, location_id) values ('Court ' || i, loc_id);
  end loop;
  return loc_id;
end;
$$;

-- Deactivate a location and all its courts
create or replace function public.admin_deactivate_location(p_location_id uuid)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
begin
  update public.courts    set is_active = false where location_id = p_location_id;
  update public.locations set is_active = false where id           = p_location_id;
end;
$$;

-- Grant / revoke
revoke execute on function public.verify_admin_password(text, text)                 from public;
revoke execute on function public.upsert_admin(text, text)                          from public;
revoke execute on function public.admin_create_admin(text, text)                    from public;
revoke execute on function public.admin_create_location_admin(text, text, uuid)     from public;
revoke execute on function public.admin_list_admins()                               from public;
revoke execute on function public.admin_delete_admin(uuid)                          from public;
revoke execute on function public.admin_delete_session_by_code(text)                from public;
revoke execute on function public.admin_set_session_password_by_code(text, text)    from public;
revoke execute on function public.admin_create_location(text, text, text, int)      from public;
revoke execute on function public.admin_deactivate_location(uuid)                   from public;

grant execute on function public.verify_admin_password(text, text)                  to service_role;
grant execute on function public.upsert_admin(text, text)                           to service_role;
grant execute on function public.admin_create_admin(text, text)                     to service_role;
grant execute on function public.admin_create_location_admin(text, text, uuid)      to service_role;
grant execute on function public.admin_list_admins()                                to service_role;
grant execute on function public.admin_delete_admin(uuid)                           to service_role;
grant execute on function public.admin_delete_session_by_code(text)                 to service_role;
grant execute on function public.admin_set_session_password_by_code(text, text)     to service_role;
grant execute on function public.admin_create_location(text, text, text, int)       to service_role;
grant execute on function public.admin_deactivate_location(uuid)                    to service_role;

-- ─────────────────────────────────────────────────────────────
--  SEED DATA
-- ─────────────────────────────────────────────────────────────

-- Default open-play session (used in early dev; safe to leave)
insert into public.sessions (id, code, state, password_hash)
values (
  'default', 'PADDLE',
  '{"players":[],"courtCount":1,"pending":null,"upcoming":[],"history":[]}'::jsonb,
  crypt('admin123', gen_salt('bf'))
)
on conflict (id) do nothing;

-- ─── Default super-admin account ─────────────────────────────────────────────
-- Username: admin   Password: Admin1234!
-- IMPORTANT: Log in and change this password immediately.
insert into public.admins (username, password_hash, role)
values ('admin', crypt('Admin1234!', gen_salt('bf')), 'admin')
on conflict (username) do nothing;
