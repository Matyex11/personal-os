-- Whole-account purge behaviour (rollback-only).
-- Semantics: individual habit/original-log deletes must NOT wipe history links;
-- DELETE auth.users must remove all user-owned rows with no orphans.
-- Uses deferred NO ACTION on habit_logs→habits and recovery→original FKs.
-- AUTHOR ONLY this pass (Docker off / migration not applied).

begin;

do $$
declare
  u1 uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  h uuid;
  missed_id uuid;
  n int;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
    'phase1b-acct@example.com', crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    now(), now(), '', '', '', ''
  );

  insert into public.habits (user_id, name, cadence, min_value, target_value)
  values (u1, 'Account habit', '{"kind":"daily","startOn":"2026-11-01"}'::jsonb, 1, 1)
  returning id into h;

  insert into public.habit_logs (user_id, habit_id, logged_on, status)
  values (u1, h, current_date, 'missed')
  returning id into missed_id;

  insert into public.habit_logs (user_id, habit_id, logged_on, status, recovers_log_id)
  values (u1, h, current_date + 1, 'recovery', missed_id);

  insert into public.chapters (user_id, title, started_on, status, is_current)
  values (u1, 'Ch', current_date, 'active', true);

  insert into public.projects (user_id, title)
  values (u1, 'Proj');

  -- Whole-account purge
  delete from auth.users where id = u1;

  select count(*) into n from public.habits where user_id = u1;
  if n <> 0 then raise exception 'orphan habits after account delete: %', n; end if;

  select count(*) into n from public.habit_logs where user_id = u1;
  if n <> 0 then raise exception 'orphan habit_logs after account delete: %', n; end if;

  select count(*) into n from public.chapters where user_id = u1;
  if n <> 0 then raise exception 'orphan chapters after account delete: %', n; end if;

  select count(*) into n from public.projects where user_id = u1;
  if n <> 0 then raise exception 'orphan projects after account delete: %', n; end if;

  select count(*) into n from public.profiles where id = u1;
  if n <> 0 then raise exception 'orphan profiles after account delete: %', n; end if;

  select count(*) into n from auth.users where id = u1;
  if n <> 0 then raise exception 'auth.users row still present after delete'; end if;
end $$;

rollback;
