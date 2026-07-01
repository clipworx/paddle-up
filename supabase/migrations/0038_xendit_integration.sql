-- Xendit payment gateway: per-venue opt-in collection + payout settings
alter table public.locations
  add column if not exists xendit_enabled boolean not null default false,
  add column if not exists xendit_payout_channel_code text,
  add column if not exists xendit_payout_account_number text,
  add column if not exists xendit_payout_account_holder_name text,
  add column if not exists xendit_platform_fee_percent numeric not null default 0;

-- Xendit payment + payout tracking per booking
alter table public.bookings
  add column if not exists payment_gateway text,
  add column if not exists xendit_invoice_id text,
  add column if not exists xendit_invoice_url text,
  add column if not exists xendit_paid_amount numeric,
  add column if not exists payout_status text,
  add column if not exists payout_disbursement_id text,
  add column if not exists payout_disbursed_at timestamptz;
