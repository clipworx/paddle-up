-- Allow individual courts to override the location's day/night rates.
-- NULL means "use the location default".

alter table public.courts
  add column if not exists custom_day_rate   numeric(10,2),
  add column if not exists custom_night_rate numeric(10,2),
  -- Unit for custom rates: 'hr' (per hour), 'pax' (per person per booking), 'flat' (fixed fee)
  add column if not exists custom_rate_unit  text not null default 'hr'
    check (custom_rate_unit in ('hr', 'pax', 'flat'));

notify pgrst, 'reload schema';
