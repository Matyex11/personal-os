-- Executable RLS + audit denial tests.
-- Seeds two auth.users rows inside a transaction and rolls back.
-- AUTHOR ONLY this pass (Docker off / migration not applied).

begin;

do $$
declare
  u1 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  u2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  ch1 uuid;
  audit_id uuid;
  n int;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values
    (
      '00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
      'phase1b-u1@example.com', crypt('x', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
      'phase1b-u2@example.com', crypt('x', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

  -- Privileged seed of audit row for u1 (clients have no INSERT grant)
  insert into public.audit_logs (user_id, actor_type, action)
  values (u1, 'system', 'test.seed')
  returning id into audit_id;

  perform set_config('request.jwt.claim.sub', u1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  insert into public.chapters (user_id, title, started_on, status, is_current)
  values (u1, 'U1 chapter', current_date, 'active', true)
  returning id into ch1;

  select count(*) into n from public.chapters;
  if n <> 1 then
    raise exception 'own-record SELECT/INSERT failed for chapters (got %)', n;
  end if;

  -- u1 can SELECT own audit row
  select count(*) into n from public.audit_logs where id = audit_id;
  if n <> 1 then
    raise exception 'u1 must SELECT own audit row (got %)', n;
  end if;

  -- Cross-user chapter INSERT: RLS → insufficient_privilege only
  begin
    insert into public.chapters (user_id, title, started_on, status, is_current)
    values (u2, 'stolen', current_date, 'planned', false);
    raise exception 'UNEXPECTED_SUCCESS: cross-user chapter INSERT';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Cross-user SELECT: switch to u2
  reset role;
  perform set_config('request.jwt.claim.sub', u2::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into n from public.chapters where id = ch1;
  if n <> 0 then
    raise exception 'cross-user SELECT must return 0 rows (got %)', n;
  end if;

  -- u2 cannot SELECT u1 audit
  select count(*) into n from public.audit_logs where id = audit_id;
  if n <> 0 then
    raise exception 'u2 must not SELECT u1 audit (got %)', n;
  end if;

  -- Hard DELETE unavailable (no GRANT)
  begin
    delete from public.chapters where id = ch1;
    raise exception 'UNEXPECTED_SUCCESS: authenticated DELETE on chapters';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Audit INSERT denied
  begin
    insert into public.audit_logs (user_id, actor_type, action)
    values (u2, 'user', 'test.should_fail');
    raise exception 'UNEXPECTED_SUCCESS: authenticated audit INSERT';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Audit UPDATE denied
  begin
    update public.audit_logs set action = 'mutated' where id = audit_id;
    raise exception 'UNEXPECTED_SUCCESS: authenticated audit UPDATE';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Audit DELETE denied
  begin
    delete from public.audit_logs where id = audit_id;
    raise exception 'UNEXPECTED_SUCCESS: authenticated audit DELETE';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  reset role;
end $$;

rollback;
