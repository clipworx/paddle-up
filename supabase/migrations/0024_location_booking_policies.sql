-- Booking policy columns for locations.

alter table public.locations
  -- Require 50% down payment for bookings longer than N hours
  add column if not exists require_downpayment      boolean not null default false,
  add column if not exists downpayment_min_hours    integer not null default 3,
  -- Prevent bookings that span the day/night rate boundary
  add column if not exists no_split_rate_booking    boolean not null default false;

notify pgrst, 'reload schema';
