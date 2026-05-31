-- Announcements: per-location notices for tournaments, court info, etc.

create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  title       text not null,
  body        text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists announcements_location_idx on public.announcements(location_id);
create index if not exists announcements_active_idx   on public.announcements(location_id, is_active);

alter table public.announcements enable row level security;

-- Public players can read active announcements
create policy "announcements public readable" on public.announcements
  for select to anon, authenticated
  using (is_active = true);
