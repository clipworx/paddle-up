-- Paddle Up admin schema.
-- Adds the admins table and helper RPCs used by the /admin panel.

create extension if not exists pgcrypto;

create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

alter table public.admins enable row level security;
-- No policies: direct table access is forbidden. service_role bypasses RLS.

create or replace function public.upsert_admin(
  p_username text,
  p_password text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  admin_id uuid;
begin
  insert into public.admins (username, password_hash)
  values (p_username, crypt(p_password, gen_salt('bf')))
  on conflict (username) do update
    set password_hash = excluded.password_hash
  returning id into admin_id;
  return admin_id;
end;
$$;

create or replace function public.verify_admin_password(
  p_username text,
  p_password text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
  admin_id uuid;
begin
  select id, password_hash into admin_id, stored_hash
    from public.admins
   where username = p_username;
  if stored_hash is null then
    return null;
  end if;
  if crypt(p_password, stored_hash) <> stored_hash then
    return null;
  end if;
  update public.admins set last_login_at = now() where id = admin_id;
  return admin_id;
end;
$$;

create or replace function public.admin_delete_session_by_code(
  p_code text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.sessions where code = upper(trim(p_code));
  if not found then
    raise exception 'session_not_found';
  end if;
end;
$$;

-- Lock these RPCs down: only service_role (server-side with SUPABASE_SECRET_KEY)
-- may call them. The proxy gates the admin routes, but defense-in-depth prevents
-- anyone with the publishable key from bypassing the proxy.
revoke execute on function public.upsert_admin(text, text) from public;
revoke execute on function public.verify_admin_password(text, text) from public;
revoke execute on function public.admin_delete_session_by_code(text) from public;

grant execute on function public.upsert_admin(text, text) to service_role;
grant execute on function public.verify_admin_password(text, text) to service_role;
grant execute on function public.admin_delete_session_by_code(text) to service_role;
