-- Payment flow: QR-based manual payment confirmation.
-- Location admins upload a QR image; customers pay, admin confirms.

-- Payment info on each location
alter table public.locations
  add column if not exists payment_qr_url        text,
  add column if not exists payment_account_name  text,
  add column if not exists payment_account_number text;

-- Expand booking status to include pending_payment
alter table public.bookings
  drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
    check (status in ('confirmed', 'cancelled', 'pending_payment'));

-- Re-create the no-overlap index to also block duplicate pending slots
drop index if exists bookings_no_overlap;
create unique index bookings_no_overlap
  on public.bookings (court_id, date, start_time)
  where status in ('confirmed', 'pending_payment');

-- Supabase Storage bucket for QR images (public read)
insert into storage.buckets (id, name, public)
values ('qr-images', 'qr-images', true)
on conflict (id) do nothing;

-- Allow anyone to read objects in the bucket
drop policy if exists "qr images public read" on storage.objects;
create policy "qr images public read" on storage.objects
  for select using (bucket_id = 'qr-images');
