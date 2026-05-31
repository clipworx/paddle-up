-- Add image support to announcements + create the storage bucket.

alter table public.announcements
  add column if not exists image_url text;

-- Create the public storage bucket (no-op if already exists)
insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

-- Allow public read of files in the bucket
drop policy if exists "announcement images public read" on storage.objects;
create policy "announcement images public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'announcement-images');
