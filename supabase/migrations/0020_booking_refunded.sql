-- Add 'refunded' booking status and a refund_reason field.

alter table public.bookings
  drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
    check (status in ('confirmed', 'cancelled', 'pending_payment', 'refunded'));

alter table public.bookings
  add column if not exists refund_reason text;
