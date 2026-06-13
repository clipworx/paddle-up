alter table public.locations add column if not exists allow_half_hour_bookings boolean not null default false;
notify pgrst, 'reload schema';
