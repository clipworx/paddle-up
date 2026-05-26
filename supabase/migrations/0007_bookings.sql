-- Court booking system for Paddle Up.
-- Run this in the Supabase SQL editor after 0006.

create extension if not exists pgcrypto;

-- ─── Courts ───────────────────────────────────────────────────────────────────

create table if not exists public.courts (
  id          uuid    primary key default gen_random_uuid(),
  name        text    not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.courts enable row level security;

drop policy if exists "courts readable" on public.courts;
create policy "courts readable" on public.courts
  for select to anon, authenticated using (true);

-- ─── Bookings ─────────────────────────────────────────────────────────────────

create table if not exists public.bookings (
  id           uuid primary key default gen_random_uuid(),
  court_id     uuid not null references public.courts(id) on delete cascade,
  date         date not null,
  start_time   time not null,
  end_time     time not null,
  booker_name  text not null,
  booker_email text not null,
  player_count int  not null default 4
    check (player_count between 2 and 4),
  notes        text,
  status       text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled')),
  created_at   timestamptz not null default now()
);

alter table public.bookings enable row level security;

drop policy if exists "bookings readable" on public.bookings;
create policy "bookings readable" on public.bookings
  for select to anon, authenticated using (true);

drop policy if exists "bookings insertable" on public.bookings;
create policy "bookings insertable" on public.bookings
  for insert to anon, authenticated
  with check (true);

-- Prevent double-booking the same court slot
create unique index if not exists bookings_no_overlap
  on public.bookings (court_id, date, start_time)
  where status = 'confirmed';

-- ─── Seed default courts ──────────────────────────────────────────────────────

insert into public.courts (name) values
  ('Court 1'),
  ('Court 2'),
  ('Court 3'),
  ('Court 4')
on conflict do nothing;
