-- Single-row table for site-wide settings editable by superadmin.
create table if not exists public.site_settings (
  id           boolean primary key default true check (id = true),
  contact_email      text,
  contact_facebook   text,
  contact_instagram  text,
  contact_whatsapp   text
);

-- Seed the row so it always exists.
insert into public.site_settings (id) values (true) on conflict (id) do nothing;

-- RLS: public read, no direct writes (all writes go through the service-role API).
alter table public.site_settings enable row level security;

create policy "site_settings public read"
  on public.site_settings for select
  using (true);

notify pgrst, 'reload schema';
