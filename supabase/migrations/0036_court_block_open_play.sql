-- Tag a court block as reserved for an Open Play session, so the booking
-- grid can render it distinctly (red) instead of the generic block style.

alter table public.court_blocks
  add column if not exists is_open_play boolean not null default false;
