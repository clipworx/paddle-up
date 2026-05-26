-- Add per-location pricing: day rate, night rate, and the hour when night rate begins.

alter table public.locations
  add column if not exists day_rate           numeric(8,2) not null default 0,
  add column if not exists night_rate         numeric(8,2) not null default 0,
  add column if not exists night_start_time   time         not null default '18:00:00';
