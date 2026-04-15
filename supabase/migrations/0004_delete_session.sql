-- Delete a session by code. Requires the session's edit password.
-- Safe to run multiple times.

create or replace function public.delete_session_by_code(
  p_code text,
  p_password text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where code = p_code;
  if stored_hash is null then
    raise exception 'session_not_found';
  end if;
  if crypt(p_password, stored_hash) <> stored_hash then
    raise exception 'invalid_password';
  end if;
  delete from public.sessions where code = p_code;
end;
$$;

grant execute on function public.delete_session_by_code(text, text) to anon, authenticated;
