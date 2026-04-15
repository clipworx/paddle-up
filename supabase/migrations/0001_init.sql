-- Paddle Up shared session schema.
-- Paste this into the Supabase SQL editor and run it once.

create extension if not exists pgcrypto;

create table if not exists public.sessions (
  id text primary key,
  code text,
  state jsonb not null default '{}'::jsonb,
  password_hash text not null,
  updated_at timestamptz not null default now()
);

-- Idempotent: add the code column on pre-existing tables.
alter table public.sessions add column if not exists code text;

-- Backfill any existing rows without a code (fall back to the id).
update public.sessions set code = id where code is null;

create unique index if not exists sessions_code_key on public.sessions (code);

alter table public.sessions enable row level security;

drop policy if exists "sessions readable" on public.sessions;
create policy "sessions readable" on public.sessions
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies: direct writes are forbidden.
-- All mutations flow through the update_session RPC below.

create or replace function public.verify_session_password(
  p_session_id text,
  p_password text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where id = p_session_id;
  if stored_hash is null then
    return false;
  end if;
  return crypt(p_password, stored_hash) = stored_hash;
end;
$$;

create or replace function public.update_session(
  p_session_id text,
  p_password text,
  p_new_state jsonb
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where id = p_session_id;
  if stored_hash is null then
    raise exception 'session_not_found';
  end if;
  if crypt(p_password, stored_hash) <> stored_hash then
    raise exception 'invalid_password';
  end if;
  update public.sessions
     set state = p_new_state,
         updated_at = now()
   where id = p_session_id;
end;
$$;

grant execute on function public.verify_session_password(text, text) to anon, authenticated;
grant execute on function public.update_session(text, text, jsonb) to anon, authenticated;

-- Seed the default session row with empty state and the initial edit password.
insert into public.sessions (id, code, state, password_hash)
values (
  'default',
  'PADDLE',
  '{"players":[],"courtCount":1,"pending":null,"upcoming":[],"history":[]}'::jsonb,
  crypt('admin123', gen_salt('bf'))
)
on conflict (id) do nothing;

-- Enable realtime replication for this table so clients can subscribe to changes.
-- If this raises "already exists", it's safe to ignore.
do $$
begin
  begin
    alter publication supabase_realtime add table public.sessions;
  exception when duplicate_object then null;
  end;
end $$;
