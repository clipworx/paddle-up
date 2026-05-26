-- Add separate operating hours and night-rate start time for weekends (Sat/Sun).
-- Weekday columns (open_hour, close_hour, night_start_time) remain unchanged.

alter table public.locations
  add column if not exists weekend_open_hour        smallint not null default 0
    check (weekend_open_hour between 0 and 23),
  add column if not exists weekend_close_hour       smallint not null default 24
    check (weekend_close_hour between 1 and 24),
  add column if not exists weekend_night_start_time time     not null default '18:00:00';
