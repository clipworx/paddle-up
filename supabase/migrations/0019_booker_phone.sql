-- Add phone number (required) and make email optional on bookings.

alter table public.bookings
  add column if not exists booker_phone text not null default '';

alter table public.bookings
  alter column booker_email drop not null;
