-- Add latitude/longitude to locations for map display.

alter table public.locations
  add column if not exists latitude  double precision,
  add column if not exists longitude double precision;
