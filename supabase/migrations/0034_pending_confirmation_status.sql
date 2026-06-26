-- Split the single "pending_payment" booking status into two: a booking
-- stays pending_payment until the customer uploads a receipt, then moves to
-- pending_confirmation while it awaits the venue's review.

alter table public.bookings
  drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
    check (status in ('confirmed', 'cancelled', 'pending_payment', 'pending_confirmation', 'refunded'));

-- The no-overlap index only protects slots while status is in this set —
-- pending_confirmation must be included or a booking loses its overlap
-- protection the moment a receipt is uploaded.
drop index if exists bookings_no_overlap;
create unique index bookings_no_overlap
  on public.bookings (court_id, date, start_time)
  where status in ('confirmed', 'pending_payment', 'pending_confirmation');
