-- Phase 1B RLS + privilege assertions (AUTHOR ONLY — not executed this pass).
-- Target after apply: personal-os-dev / qyysmgwdvhftbgwhpbjt.
-- Assumes two test users u1 / u2 exist in auth.users with matching profiles.

begin;

-- ---------------------------------------------------------------------------
-- Privilege matrix smoke (information_schema / has_table_privilege)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles','chapters','module_activations','habits','habit_logs',
    'projects','milestones','tasks','audit_logs'
  ]
  loop
    if has_table_privilege('anon', format('public.%I', t), 'SELECT')
       or has_table_privilege('anon', format('public.%I', t), 'INSERT')
       or has_table_privilege('anon', format('public.%I', t), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', t), 'DELETE')
       or has_table_privilege('anon', format('public.%I', t), 'TRUNCATE')
       or has_table_privilege('anon', format('public.%I', t), 'REFERENCES')
       or has_table_privilege('anon', format('public.%I', t), 'TRIGGER')
    then
      raise exception 'anon must have no table privileges on %', t;
    end if;

    if has_table_privilege('authenticated', format('public.%I', t), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', t), 'TRUNCATE')
       or has_table_privilege('authenticated', format('public.%I', t), 'REFERENCES')
       or has_table_privilege('authenticated', format('public.%I', t), 'TRIGGER')
    then
      raise exception 'authenticated must not have DELETE/TRUNCATE/REFERENCES/TRIGGER on %', t;
    end if;

    if not has_table_privilege('authenticated', format('public.%I', t), 'SELECT') then
      raise exception 'authenticated missing SELECT on %', t;
    end if;
    if not has_table_privilege('authenticated', format('public.%I', t), 'INSERT') then
      raise exception 'authenticated missing INSERT on %', t;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE') then
    raise exception 'authenticated must not UPDATE audit_logs';
  end if;

  foreach t in array array[
    'profiles','chapters','module_activations','habits','habit_logs',
    'projects','milestones','tasks'
  ]
  loop
    if not has_table_privilege('authenticated', format('public.%I', t), 'UPDATE') then
      raise exception 'authenticated missing UPDATE on %', t;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- RLS: own-record access vs cross-user denial (pseudocode roles)
-- Replace :u1 / :u2 with real auth.uids() when executing under JWT claims.
-- ---------------------------------------------------------------------------

-- set local role authenticated;
-- select set_config('request.jwt.claim.sub', :u1::text, true);
-- select set_config('request.jwt.claim.role', 'authenticated', true);

-- Expect: SELECT/INSERT/UPDATE own chapters succeed.
-- Expect: SELECT other user’s chapters returns 0 rows.
-- Expect: INSERT with user_id = :u2 fails WITH CHECK.
-- Expect: UPDATE other user’s row affects 0 rows / fails USING.
-- Expect: DELETE on chapters/habits/habit_logs/projects/milestones/tasks
--         fails with insufficient_privilege (no GRANT + no policy).

rollback;
