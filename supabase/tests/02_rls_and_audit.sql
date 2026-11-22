-- Executable RLS + audit denial tests.
-- Seeds two auth.users rows inside a transaction and rolls back.
-- AUTHOR ONLY this pass (Docker off / migration not applied).

begin;

create temporary table _t (
  u1 uuid primary key,
  u2 uuid primary key
);

do $$
declare
  u1 uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  u2 uuid := 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  ch1 uuid;
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

  insert into _t(u1, u2) values (u1, u2);

  -- As u1: create own chapter
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

  -- Cross-user INSERT must fail WITH CHECK
  begin
    insert into public.chapters (user_id, title, started_on, status, is_current)
    values (u2, 'stolen', current_date, 'planned', false);
    raise exception 'cross-user chapter INSERT should have failed';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%cross-user chapter INSERT%' then raise;
      end if;
      -- RLS violation / check violation expected
      null;
  end;

  -- Cross-user SELECT: switch to u2, must not see u1 chapter
  reset role;
  perform set_config('request.jwt.claim.sub', u2::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into n from public.chapters where id = ch1;
  if n <> 0 then
    raise exception 'cross-user SELECT must return 0 rows (got %)', n;
  end if;

  -- Hard DELETE unavailable
  begin
    delete from public.chapters where id = ch1;
    raise exception 'authenticated DELETE on chapters must fail';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%DELETE on chapters must fail%' then raise;
      end if;
      null;
  end;

  -- Audit INSERT denied (no grant / no policy)
  begin
    insert into public.audit_logs (user_id, actor_type, action)
    values (u2, 'user', 'test.should_fail');
    raise exception 'authenticated audit INSERT must fail';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like '%audit INSERT must fail%' then raise;
      end if;
      null;
  end;

  reset role;
end $$;

rollback;
