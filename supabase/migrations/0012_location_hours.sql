-- Add configurable operating hours per location.
-- open_hour: first bookable hour (0-23, 0 = midnight)
-- close_hour: last bookable hour + 1 (1-24, 24 = midnight end-of-day)

alter table public.locations
  add column if not exists open_hour  smallint not null default 0
    check (open_hour between 0 and 23),
  add column if not exists close_hour smallint not null default 24
    check (close_hour between 1 and 24);
