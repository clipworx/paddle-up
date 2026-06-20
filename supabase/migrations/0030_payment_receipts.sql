-- Payment receipt upload: customers upload proof of payment via a unique link
-- (the booking's own id), so admins can verify before confirming.

alter table public.bookings
  add column if not exists receipt_url        text,
  add column if not exists receipt_uploaded_at timestamptz;

-- Supabase Storage bucket for receipt uploads (public read)
insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', true)
on conflict (id) do nothing;

drop policy if exists "payment receipts public read" on storage.objects;
create policy "payment receipts public read" on storage.objects
  for select using (bucket_id = 'payment-receipts');
