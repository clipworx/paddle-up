-- Open Play restart: self-service device identity needs many concurrent
-- writers per session (every device, not just the host), so we add an
-- optimistic-concurrency version column + a password-less CAS RPC for
-- self-service player actions. Host actions keep the existing unconditional
-- overwrite path (update_session_by_code), now also bumping version.

alter table public.sessions add column if not exists version integer not null default 0;

-- Password-less CAS update for self-service player actions (join, rename,
-- set tier, queue join/leave, complete match). 0 rows returned = conflict;
-- caller re-reads state+version and retries.
create or replace function public.update_session_state_cas(
  p_code text,
  p_expected_version int,
  p_new_state jsonb
) returns table(state jsonb, version int)
language sql
security definer
set search_path = public, extensions
as $$
  update public.sessions
     set state = p_new_state,
         version = version + 1,
         updated_at = now()
   where code = p_code
     and version = p_expected_version
  returning sessions.state, sessions.version;
$$;

grant execute on function public.update_session_state_cas(text, int, jsonb) to anon, authenticated;

-- Unchanged behavior (password-gated, unconditional overwrite), now also
-- bumps version so the column stays monotonic across both write paths.
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
         version = version + 1,
         updated_at = now()
   where code = p_code;
end;
$$;

grant execute on function public.update_session_by_code(text, text, jsonb) to anon, authenticated;
