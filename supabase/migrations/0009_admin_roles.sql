-- Two-tier admin roles: 'admin' (super) and 'location_admin' (scoped).
-- Run this in the Supabase SQL editor after 0008.

-- ─── Extend admins table ──────────────────────────────────────────────────────

alter table public.admins
  add column if not exists role text not null default 'admin'
    check (role in ('admin', 'location_admin')),
  add column if not exists location_id uuid
    references public.locations(id) on delete set null;

-- location_admin must always have a location
alter table public.admins
  drop constraint if exists location_admin_needs_location;
alter table public.admins
  add constraint location_admin_needs_location
    check (role != 'location_admin' or location_id is not null);

-- ─── Update verify_admin_password to return role info ────────────────────────
-- Returns jsonb: { id, role, location_id } on success, null on failure.

create or replace function public.verify_admin_password(
  p_username text,
  p_password text
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash      text;
  admin_id         uuid;
  admin_role       text;
  admin_location   uuid;
begin
  select id, password_hash, role, location_id
    into admin_id, stored_hash, admin_role, admin_location
    from public.admins
   where username = p_username;

  if stored_hash is null then
    return null;
  end if;
  if crypt(p_password, stored_hash) <> stored_hash then
    return null;
  end if;

  update public.admins set last_login_at = now() where id = admin_id;

  return jsonb_build_object(
    'id',          admin_id,
    'role',        admin_role,
    'location_id', admin_location
  );
end;
$$;

-- ─── RPC: create a location admin account ─────────────────────────────────────

create or replace function public.admin_create_location_admin(
  p_username    text,
  p_password    text,
  p_location_id uuid
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  insert into public.admins (username, password_hash, role, location_id)
  values (
    trim(p_username),
    crypt(p_password, gen_salt('bf')),
    'location_admin',
    p_location_id
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- ─── RPC: list all admins (with location name) ────────────────────────────────

create or replace function public.admin_list_admins()
returns table (
  id          uuid,
  username    text,
  role        text,
  location_id uuid,
  location_name text,
  created_at  timestamptz,
  last_login_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.username,
    a.role,
    a.location_id,
    l.name as location_name,
    a.created_at,
    a.last_login_at
  from public.admins a
  left join public.locations l on l.id = a.location_id
  order by a.role, a.username;
$$;

-- ─── RPC: delete an admin account ────────────────────────────────────────────

create or replace function public.admin_delete_admin(
  p_admin_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.admins where id = p_admin_id;
end;
$$;

-- Lock all new RPCs to service_role only
revoke execute on function public.verify_admin_password(text, text) from public;
grant  execute on function public.verify_admin_password(text, text) to service_role;

revoke execute on function public.admin_create_location_admin(text, text, uuid) from public;
grant  execute on function public.admin_create_location_admin(text, text, uuid) to service_role;

revoke execute on function public.admin_list_admins() from public;
grant  execute on function public.admin_list_admins() to service_role;

revoke execute on function public.admin_delete_admin(uuid) from public;
grant  execute on function public.admin_delete_admin(uuid) to service_role;
