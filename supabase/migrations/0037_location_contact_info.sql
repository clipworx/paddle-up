-- Contact info shown to customers for booking concerns/support
alter table public.locations
  add column if not exists contact_email text,
  add column if not exists contact_phone text;
