-- Add a unique URL slug to each location for per-location booking pages.
-- slug is nullable so existing RPC (admin_create_location) still works;
-- the API layer sets it immediately after creation.

alter table public.locations
  add column if not exists slug text;

-- Backfill existing locations: slugify the name, resolve duplicates with id suffix.
update public.locations
  set slug = regexp_replace(
    regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'),
    '^-+|-+$', '', 'g'
  )
  where slug is null or slug = '';

with dupes as (
  select id,
    row_number() over (partition by slug order by created_at) as rn
  from public.locations
)
update public.locations l
  set slug = l.slug || '-' || substr(l.id::text, 1, 6)
  from dupes d
  where l.id = d.id and d.rn > 1;

alter table public.locations
  drop constraint if exists locations_slug_unique;
alter table public.locations
  add constraint locations_slug_unique unique (slug);

notify pgrst, 'reload schema';
