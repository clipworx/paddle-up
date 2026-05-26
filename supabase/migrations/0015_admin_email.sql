-- Add optional email address to admin accounts (used for booking notifications).

alter table public.admins
  add column if not exists email text;

-- Update admin_list_admins to expose the email field.
create or replace function public.admin_list_admins()
returns table (
  id            uuid,
  username      text,
  role          text,
  location_id   uuid,
  location_name text,
  email         text,
  created_at    timestamptz,
  last_login_at timestamptz
)
language sql security definer set search_path = public
as $$
  select a.id, a.username, a.role, a.location_id, l.name,
         a.email, a.created_at, a.last_login_at
    from public.admins a
    left join public.locations l on l.id = a.location_id
   order by a.role, a.username;
$$;
