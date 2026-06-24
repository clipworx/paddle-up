-- The Open Play rewrite changed the session state shape from
-- {players, courtCount, pending, upcoming, history, queue, ...} to
-- {players, courtCount, courts}. create_session still seeded the old shape
-- (no `courts` array at all), which crashes tryFormMatches the moment any
-- self-service action runs on a freshly created session. Fix the seed and
-- backfill any session rows already created with the stale shape.

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
        '{"players":[],"courtCount":1,"courts":[null]}'::jsonb,
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

grant execute on function public.create_session(text) to anon, authenticated;

-- Backfill: any session row still missing `courts` gets the new shape,
-- preserving its existing players/courtCount and padding `courts` to match.
update public.sessions s
   set state = jsonb_build_object(
         'players', coalesce(s.state->'players', '[]'::jsonb),
         'courtCount', coalesce(s.state->'courtCount', '1'::jsonb),
         'courts', (
           select coalesce(jsonb_agg(null::jsonb), '[null]'::jsonb)
             from generate_series(1, greatest(1, coalesce((s.state->>'courtCount')::int, 1)))
         )
       )
 where s.state->'courts' is null;
