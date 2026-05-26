-- Locations: group courts under named facilities.
-- Run this in the Supabase SQL editor after 0007.

-- ─── Locations ────────────────────────────────────────────────────────────────

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  address     text,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.locations enable row level security;

drop policy if exists "locations readable" on public.locations;
create policy "locations readable" on public.locations
  for select to anon, authenticated using (true);

-- ─── Attach courts to locations ───────────────────────────────────────────────

-- Add location_id FK to courts (nullable during migration; required after backfill)
alter table public.courts
  add column if not exists location_id uuid references public.locations(id) on delete cascade;

-- Seed a default location and move all existing courts into it
do $$
declare
  loc_id uuid;
begin
  insert into public.locations (name, address)
  values ('Main Facility', null)
  returning id into loc_id;

  update public.courts set location_id = loc_id where location_id is null;
end;
$$;

-- Now make location_id required
alter table public.courts
  alter column location_id set not null;

-- ─── Admin RPCs ───────────────────────────────────────────────────────────────

-- Creates a location and automatically adds `p_court_count` courts named "Court N".
create or replace function public.admin_create_location(
  p_name        text,
  p_address     text,
  p_description text,
  p_court_count int
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  loc_id uuid;
  i      int;
begin
  if p_court_count < 1 or p_court_count > 16 then
    raise exception 'court_count_out_of_range';
  end if;

  insert into public.locations (name, address, description)
  values (trim(p_name), nullif(trim(p_address), ''), nullif(trim(p_description), ''))
  returning id into loc_id;

  for i in 1..p_court_count loop
    insert into public.courts (name, location_id)
    values ('Court ' || i, loc_id);
  end loop;

  return loc_id;
end;
$$;

-- Deactivates a location and all its courts.
create or replace function public.admin_deactivate_location(
  p_location_id uuid
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.courts   set is_active = false where location_id = p_location_id;
  update public.locations set is_active = false where id = p_location_id;
end;
$$;

revoke execute on function public.admin_create_location(text, text, text, int) from public;
revoke execute on function public.admin_deactivate_location(uuid) from public;

grant execute on function public.admin_create_location(text, text, text, int) to service_role;
grant execute on function public.admin_deactivate_location(uuid) to service_role;
