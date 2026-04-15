-- Adds session creation by code + code-scoped RPCs so each open-play
-- session lives at /<code>. Safe to run multiple times.

create or replace function public.create_session(
  p_password text
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  attempts int := 0;
  idx int;
begin
  if p_password is null or length(p_password) < 1 then
    raise exception 'password_required';
  end if;

  loop
    new_code := '';
    for idx in 1..6 loop
      new_code := new_code ||
        substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    begin
      insert into public.sessions (id, code, state, password_hash)
      values (
        gen_random_uuid()::text,
        new_code,
        '{"players":[],"courtCount":1,"pending":null,"upcoming":[],"history":[]}'::jsonb,
        crypt(p_password, gen_salt('bf'))
      );
      return new_code;
    exception when unique_violation then
      attempts := attempts + 1;
      if attempts > 10 then
        raise exception 'failed_to_generate_unique_code';
      end if;
    end;
  end loop;
end;
$$;

create or replace function public.verify_session_password_by_code(
  p_code text,
  p_password text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash from public.sessions where code = p_code;
  if stored_hash is null then
    return false;
  end if;
  return crypt(p_password, stored_hash) = stored_hash;
end;
$$;

create or replace function public.update_session_by_code(
  p_code text,
  p_password text,
  p_new_state jsonb
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
  update public.sessions
     set state = p_new_state,
         updated_at = now()
   where code = p_code;
end;
$$;

grant execute on function public.create_session(text) to anon, authenticated;
grant execute on function public.verify_session_password_by_code(text, text) to anon, authenticated;
grant execute on function public.update_session_by_code(text, text, jsonb) to anon, authenticated;
