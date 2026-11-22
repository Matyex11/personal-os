-- Executable privilege + function EXECUTE assertions.
-- Fail with RAISE EXCEPTION. Rollback keeps the session clean.
-- AUTHOR ONLY this pass (Docker off / migration not applied).

begin;

do $$
declare
  t text;
  u1 uuid := '11111111-1111-4111-8111-111111111111';
  inserted_id uuid;
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

  -- cadence validator: authenticated HAS execute; anon/service_role do NOT
  if not has_function_privilege('authenticated', 'public.is_valid_habit_cadence(jsonb)', 'EXECUTE') then
    raise exception 'authenticated must EXECUTE is_valid_habit_cadence';
  end if;
  if has_function_privilege('anon', 'public.is_valid_habit_cadence(jsonb)', 'EXECUTE') then
    raise exception 'anon must not EXECUTE is_valid_habit_cadence';
  end if;
  if has_function_privilege('service_role', 'public.is_valid_habit_cadence(jsonb)', 'EXECUTE') then
    raise exception 'service_role must not EXECUTE is_valid_habit_cadence';
  end if;

  -- Prove authenticated can insert a valid habit under CHECK (needs EXECUTE + grants)
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
    'phase1b-priv@example.com', crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

  perform set_config('request.jwt.claim.sub', u1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  insert into public.habits (user_id, name, cadence, min_value, target_value)
  values (
    u1,
    'Cadence EXECUTE proof',
    '{"kind":"daily","startOn":"2026-11-01"}'::jsonb,
    1,
    1
  )
  returning id into inserted_id;

  if inserted_id is null then
    raise exception 'authenticated insert of valid habit under cadence CHECK failed';
  end if;

  reset role;
end $$;

rollback;
