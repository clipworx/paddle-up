-- Delete all cancelled bookings.
-- Run this in the Supabase SQL editor or via the CLI:
--   supabase db execute --file supabase/scripts/delete_cancelled_bookings.sql

delete from public.bookings
where status = 'cancelled';
