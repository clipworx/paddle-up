-- Ensure realtime delivers full row payloads on UPDATE and that
-- public.sessions is actually in the supabase_realtime publication.
-- Safe to run multiple times.

alter table public.sessions replica identity full;

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.sessions';
  end if;
end $$;
