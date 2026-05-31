-- Add branding fields to locations
alter table public.locations
  add column if not exists logo_url text,
  add column if not exists accent_color text;

-- Storage bucket for location logos (public)
insert into storage.buckets (id, name, public)
values ('location-logos', 'location-logos', true)
on conflict (id) do nothing;

-- Allow public reads
create policy "Public read location logos"
  on storage.objects for select
  using (bucket_id = 'location-logos');

-- Allow service role full access (admin API uses service key)
create policy "Service role manages location logos"
  on storage.objects for all
  using (bucket_id = 'location-logos' and auth.role() = 'service_role');
