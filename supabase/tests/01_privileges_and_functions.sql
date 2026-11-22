-- Executable privilege + function EXECUTE assertions.
-- Fail with RAISE EXCEPTION. Rollback keeps the session clean.
-- AUTHOR ONLY this pass (Docker off / migration not applied).

begin;

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
  end loop;

  foreach t in array array[
    'profiles','chapters','module_activations','habits','habit_logs',
    'projects','milestones','tasks'
  ]
  loop
    if not has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       or not has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
    then
      raise exception 'authenticated missing INSERT/UPDATE on %', t;
    end if;
  end loop;

  if has_table_privilege('authenticated', 'public.audit_logs', 'INSERT')
     or has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_logs', 'DELETE')
  then
    raise exception 'authenticated must only SELECT audit_logs (no INSERT/UPDATE/DELETE)';
  end if;

  -- handle_new_user
  if has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.handle_new_user()', 'EXECUTE')
  then
    raise exception 'API roles must not EXECUTE handle_new_user';
  end if;
  if not has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'EXECUTE') then
    raise exception 'supabase_auth_admin must EXECUTE handle_new_user';
  end if;

  -- trigger functions: no API EXECUTE
  if has_function_privilege('anon', 'public.enforce_habit_recovery_insert()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enforce_habit_recovery_insert()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.enforce_habit_recovery_insert()', 'EXECUTE')
  then
    raise exception 'API roles must not EXECUTE enforce_habit_recovery_insert';
  end if;
  if has_function_privilege('anon', 'public.enforce_habit_log_immutability()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.enforce_habit_log_immutability()', 'EXECUTE')
     or has_function_privilege('service_role', 'public.enforce_habit_log_immutability()', 'EXECUTE')
  then
    raise exception 'API roles must not EXECUTE enforce_habit_log_immutability';
  end if;
end $$;

rollback;
