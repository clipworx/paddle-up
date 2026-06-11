-- Add optional facility photo to locations (shown on the booking page).
alter table public.locations
  add column if not exists photo_url text;

-- Public storage bucket for location facility photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'location-photos',
  'location-photos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
