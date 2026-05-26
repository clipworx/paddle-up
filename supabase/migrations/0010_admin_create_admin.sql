-- Add an RPC for creating new super-admin accounts from the admin panel.
-- Unlike upsert_admin (which updates on conflict), this fails on duplicate usernames.

create or replace function public.admin_create_admin(
  p_username text,
  p_password text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  insert into public.admins (username, password_hash, role)
  values (trim(p_username), crypt(p_password, gen_salt('bf')), 'admin')
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.admin_create_admin(text, text) from public;
grant  execute on function public.admin_create_admin(text, text) to service_role;
