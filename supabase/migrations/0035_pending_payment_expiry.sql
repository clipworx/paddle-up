-- Let a location auto-cancel bookings that have sat in pending_payment (no
-- receipt uploaded) for too long, freeing the slot back up. Off by default.

alter table public.locations
  add column if not exists auto_expire_pending_payment  boolean not null default false,
  add column if not exists pending_payment_expiry_hours integer not null default 5;

-- Checked opportunistically on read (no cron/scheduled-job infra in this
-- app) — called from every booking-listing endpoint before it queries, so
-- by the time anyone is looking at bookings, overdue ones have already been
-- cancelled. Scoped per-location by that location's own toggle/threshold;
-- a no-op location-wide sweep costs nothing when nothing is overdue.
create or replace function public.expire_pending_bookings()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.bookings b
  set status = 'cancelled'
  where b.status = 'pending_payment'
    and exists (
      select 1
      from public.courts c
      join public.locations l on l.id = c.location_id
      where c.id = b.court_id
        and l.auto_expire_pending_payment = true
        and b.created_at < now() - make_interval(hours => l.pending_payment_expiry_hours)
    );
end;
$$;

grant execute on function public.expire_pending_bookings() to anon, authenticated;

notify pgrst, 'reload schema';
