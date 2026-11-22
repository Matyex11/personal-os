-- Phase 1B composite FK deletion behaviour (AUTHOR ONLY — not executed).
-- Documents expected PG17 column-specific ON DELETE SET NULL behaviour.
-- Prefer running as a privileged migrator role AFTER L3 apply — not via app JWT.

begin;

-- Setup sketch (replace ids):
-- u := auth user
-- c := chapter owned by u
-- h := habit with chapter_id = c
-- p := project with chapter_id = c
-- m := milestone with project_id = p
-- t := task with project_id = p and milestone_id = m
-- hl := habit_log for h

-- 1) DELETE chapter c
--    Expected:
--      habits.chapter_id IS NULL for h; habits.user_id still = u (NOT null)
--      projects.chapter_id IS NULL for p; projects.user_id still = u
--      module_activations chapter-scoped rows for c are CASCADE-removed
--      chapters row gone (service/migration path only — app has no DELETE grant)

-- 2) DELETE project p (privileged path only)
--    Expected:
--      milestones.project_id IS NULL for m; milestones.user_id still = u
--      tasks.project_id IS NULL for t; tasks.user_id still = u
--      tasks.milestone_id unchanged until milestone delete

-- 3) DELETE milestone m
--    Expected:
--      tasks.milestone_id IS NULL; tasks.user_id still = u

-- 4) DELETE habit h while habit_logs exist
--    Expected:
--      FAIL with RESTRICT / foreign_key_violation
--      habit_logs rows remain; history preserved

-- 5) Cross-user FK attempt
--    Expected:
--      INSERT habit with (user_id = u1, chapter_id = chapter_of_u2) fails FK
--      INSERT habit_log recovery pointing at other user’s log fails FK

do $$
begin
  -- Catalog checks: confirm delete actions recorded as expected.
  -- (Exact oid/names depend on apply; tighten after first apply.)
  if not exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    where rel.relname = 'habits'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%ON DELETE SET NULL%chapter_id%'
  ) then
    raise notice 'REVIEW: habits chapter FK should use ON DELETE SET NULL (chapter_id)';
  end if;

  if not exists (
    select 1
    from pg_constraint c
    join pg_class rel on rel.oid = c.conrelid
    where rel.relname = 'habit_logs'
      and c.contype = 'f'
      and pg_get_constraintdef(c.oid) ilike '%habits%'
      and pg_get_constraintdef(c.oid) ilike '%RESTRICT%'
  ) then
    raise notice 'REVIEW: habit_logs → habits should ON DELETE RESTRICT';
  end if;
end $$;

rollback;
