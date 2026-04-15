-- Admin-only: reset a session's edit password without knowing the old one.

create or replace function public.admin_set_session_password_by_code(
  p_code text,
  p_new_password text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update public.sessions
     set password_hash = crypt(p_new_password, gen_salt('bf')),
         updated_at = now()
   where code = upper(trim(p_code));
  if not found then
    raise exception 'session_not_found';
  end if;
end;
$$;

revoke execute on function public.admin_set_session_password_by_code(text, text)
  from public;
grant execute on function public.admin_set_session_password_by_code(text, text)
  to service_role;
