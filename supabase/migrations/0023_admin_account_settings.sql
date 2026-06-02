-- Ensure email column exists (added in 0015; repeated here for schema-cache safety).
alter table public.admins
  add column if not exists email                text;

-- Add notification preference columns to admins table.
alter table public.admins
  add column if not exists notify_new_booking   boolean not null default true,
  add column if not exists notify_cancellation  boolean not null default true;

-- Reload PostgREST schema cache so the new columns are visible immediately.
notify pgrst, 'reload schema';

-- RPC to update an admin's password (called from server-side only).
create or replace function public.update_admin_password(
  p_admin_id  uuid,
  p_new_password text
) returns void language plpgsql security definer as $$
begin
  update public.admins
     set password_hash = crypt(p_new_password, gen_salt('bf'))
   where id = p_admin_id;
end;
$$;
