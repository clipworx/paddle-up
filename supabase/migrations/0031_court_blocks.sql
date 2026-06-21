-- Admin-imposed unavailability windows (maintenance, private events, closures).
-- Stored as one row per court per date so the grid query stays identical to bookings.

create table if not exists public.court_blocks (
  id         uuid primary key default gen_random_uuid(),
  court_id   uuid not null references public.courts(id) on delete cascade,
  date       date not null,
  start_time time not null,
  end_time   time not null,
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists court_blocks_court_date_idx on public.court_blocks (court_id, date);

alter table public.court_blocks enable row level security;

-- Public/anon needs read access so the booking grid can show blocked slots.
-- Writes always go through the service-role admin client, so no insert/update/delete policy is needed.
drop policy if exists "court blocks readable" on public.court_blocks;
create policy "court blocks readable" on public.court_blocks
  for select to anon, authenticated using (true);
