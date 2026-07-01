-- Proof of refund for Xendit-paid bookings — either Xendit's own refund ID
-- (automated path) or an admin-entered reference number (manual fallback).
alter table public.bookings
  add column if not exists xendit_refund_id text;
