-- Parent-child court relationships for shared physical spaces.
-- Example: a basketball court that splits into 3 pickleball courts.
-- Booking the parent blocks all children; booking a child blocks the parent.
-- Only one level of nesting is supported (enforced in application logic).

alter table public.courts
  add column if not exists parent_court_id uuid
    references public.courts(id)
    on delete set null;

-- A court cannot reference itself as its own parent.
alter table public.courts
  drop constraint if exists courts_no_self_parent;
alter table public.courts
  add constraint courts_no_self_parent
    check (parent_court_id is distinct from id);

notify pgrst, 'reload schema';
