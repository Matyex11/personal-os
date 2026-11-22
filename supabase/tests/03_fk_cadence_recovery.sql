-- Executable FK deletion, cadence CHECK, and recovery integrity tests.
-- AUTHOR ONLY this pass (Docker off / migration not applied).

begin;

do $$
declare
  u1 uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  u2 uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  ch uuid;
  h uuid;
  p uuid;
  m uuid;
  t uuid;
  missed_id uuid;
  completed_id uuid;
  chapter_id_after uuid;
  milestone_project_after uuid;
  task_project_after uuid;
  milestone_id_after uuid;
  ok boolean;
  v boolean;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values
    (
      '00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
      'phase1b-fk1@example.com', crypt('x', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
      'phase1b-fk2@example.com', crypt('x', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

  -- Direct cadence function cases (fail-closed TRUE/FALSE)
  if public.is_valid_habit_cadence(null) is distinct from false then
    raise exception 'NULL cadence must be FALSE';
  end if;
  if public.is_valid_habit_cadence('[]'::jsonb) is distinct from false then
    raise exception 'non-object cadence must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'missing kind must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily"}'::jsonb) is distinct from false then
    raise exception 'missing startOn must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"hourly","startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'invalid kind must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily","startOn":"2026-13-40"}'::jsonb) is distinct from false then
    raise exception 'invalid calendar startOn must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily","startOn":"2026-11-10","endOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'endOn before startOn must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily","startOn":"2026-11-01","endOn":"not-a-date"}'::jsonb) is distinct from false then
    raise exception 'invalid endOn must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"weekdays","weekdays":[],"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'empty weekdays must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"weekdays","weekdays":[0,8],"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'out-of-range weekdays must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"weekdays","weekdays":[1.5],"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'decimal weekdays must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"weekdays","weekdays":["1"],"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'string weekdays must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"weekdays","startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'weekdays kind missing weekdays must be FALSE';
  end if;

  -- daily + malformed weekdays (Zod parity: if present, must be valid array)
  if public.is_valid_habit_cadence('{"kind":"daily","weekdays":[],"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'daily empty weekdays must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily","weekdays":"1","startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'daily string weekdays must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily","weekdays":null,"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'daily null weekdays must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily","weekdays":[1.5],"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'daily decimal weekday must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily","weekdays":["1"],"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'daily string weekday element must be FALSE';
  end if;
  if public.is_valid_habit_cadence('{"kind":"daily","weekdays":[0],"startOn":"2026-11-01"}'::jsonb) is distinct from false then
    raise exception 'daily out-of-range weekday must be FALSE';
  end if;

  v := public.is_valid_habit_cadence('{"kind":"daily","startOn":"2026-11-01"}'::jsonb);
  if v is distinct from true then
    raise exception 'valid daily must be TRUE';
  end if;
  v := public.is_valid_habit_cadence('{"kind":"weekdays","weekdays":[1,3,5],"startOn":"2026-11-01","endOn":"2026-11-30"}'::jsonb);
  if v is distinct from true then
    raise exception 'valid weekdays must be TRUE';
  end if;
  -- daily may include optional valid weekdays
  v := public.is_valid_habit_cadence('{"kind":"daily","weekdays":[1],"startOn":"2026-11-01"}'::jsonb);
  if v is distinct from true then
    raise exception 'daily with optional valid weekdays must be TRUE';
  end if;

  insert into public.chapters (id, user_id, title, started_on, status, is_current)
  values (gen_random_uuid(), u1, 'FK chapter', current_date, 'active', true)
  returning id into ch;

  insert into public.habits (user_id, chapter_id, name, cadence, min_value, target_value)
  values (
    u1, ch, 'Valid',
    '{"kind":"daily","startOn":"2026-11-01"}'::jsonb,
    1, 1
  ) returning id into h;

  begin
    insert into public.habits (user_id, name, cadence, min_value, target_value)
    values (u1, 'bad kind', '{"kind":"hourly","startOn":"2026-11-01"}'::jsonb, 1, 1);
    raise exception 'UNEXPECTED_SUCCESS: invalid cadence kind insert';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.habits (user_id, name, cadence, min_value, target_value)
    values (u1, 'neg min', '{"kind":"daily","startOn":"2026-11-01"}'::jsonb, -1, 1);
    raise exception 'UNEXPECTED_SUCCESS: min_value < 0';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Cross-user chapter FK
  begin
    insert into public.habits (user_id, chapter_id, name, cadence, min_value, target_value)
    values (u2, ch, 'cross', '{"kind":"daily","startOn":"2026-11-01"}'::jsonb, 1, 1);
    raise exception 'UNEXPECTED_SUCCESS: cross-user chapter FK';
  exception
    when foreign_key_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  insert into public.projects (user_id, chapter_id, title)
  values (u1, ch, 'P') returning id into p;
  insert into public.milestones (user_id, project_id, title)
  values (u1, p, 'M') returning id into m;
  insert into public.tasks (user_id, project_id, milestone_id, title)
  values (u1, p, m, 'T') returning id into t;

  insert into public.habit_logs (user_id, habit_id, logged_on, status, value)
  values (u1, h, current_date, 'missed', null)
  returning id into missed_id;

  begin
    insert into public.habit_logs (user_id, habit_id, logged_on, status, value)
    values (u1, h, current_date - 1, 'completed', -5);
    raise exception 'UNEXPECTED_SUCCESS: negative habit_logs.value';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  insert into public.habit_logs (user_id, habit_id, logged_on, status)
  values (u1, h, current_date - 2, 'completed')
  returning id into completed_id;

  -- Recovery targeting completed must fail (trigger)
  begin
    insert into public.habit_logs (user_id, habit_id, logged_on, status, recovers_log_id)
    values (u1, h, current_date, 'recovery', completed_id);
    raise exception 'UNEXPECTED_SUCCESS: recovery on completed';
  exception
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      if sqlerrm like 'recovery may only link to missed or partial logs' then
        null;
      else
        raise;
      end if;
  end;

  -- Valid recovery on missed
  insert into public.habit_logs (user_id, habit_id, logged_on, status, recovers_log_id)
  values (u1, h, current_date + 1, 'recovery', missed_id);

  -- Cannot rewrite original missed status
  begin
    update public.habit_logs
    set status = 'completed'
    where id = missed_id;

    raise exception using
      errcode = 'P0002',
      message = 'UNEXPECTED_SUCCESS: original habit log was rewritten';

  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'cannot rewrite a habit log that has recovery links' then
        raise;
      end if;
  end;

  -- Individual habit delete: deferred NO ACTION — force IMMEDIATE check
  begin
    delete from public.habits where id = h;
    set constraints habit_logs_habit_fkey immediate;
    raise exception 'UNEXPECTED_SUCCESS: habit delete with logs';
  exception
    when foreign_key_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;
  -- Subtransaction rolled back → rows must still exist for later steps
  if not exists (select 1 from public.habits where id = h) then
    raise exception 'habit missing after failed deferred delete';
  end if;
  if not exists (select 1 from public.habit_logs where id = missed_id) then
    raise exception 'missed log missing after failed habit delete';
  end if;

  -- Individual original log delete must not break recovery links
  begin
    delete from public.habit_logs where id = missed_id;
    set constraints habit_logs_recovery_fkey immediate;
    raise exception 'UNEXPECTED_SUCCESS: delete original with recovery';
  exception
    when foreign_key_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;
  if not exists (select 1 from public.habit_logs where id = missed_id) then
    raise exception 'original log missing after failed deferred delete';
  end if;
  if not exists (
    select 1 from public.habit_logs
    where recovers_log_id = missed_id and status = 'recovery'
  ) then
    raise exception 'recovery log missing after failed original delete';
  end if;

  -- Column-specific SET NULL: delete chapter clears chapter_id only
  delete from public.chapters where id = ch;
  select chapter_id into chapter_id_after from public.habits where id = h;
  if chapter_id_after is not null then
    raise exception 'habits.chapter_id should be NULL after chapter delete';
  end if;
  select user_id = u1 into ok from public.habits where id = h;
  if not ok then
    raise exception 'habits.user_id must remain after chapter delete';
  end if;

  select chapter_id into chapter_id_after from public.projects where id = p;
  if chapter_id_after is not null then
    raise exception 'projects.chapter_id should be NULL after chapter delete';
  end if;

  -- Project delete: assert milestone.project_id and task.project_id independently
  delete from public.projects where id = p;

  select project_id into milestone_project_after from public.milestones where id = m;
  if milestone_project_after is not null then
    raise exception 'milestones.project_id should be NULL after project delete';
  end if;

  select project_id into task_project_after from public.tasks where id = t;
  if task_project_after is not null then
    raise exception 'tasks.project_id should be NULL after project delete';
  end if;

  select user_id = u1 into ok from public.milestones where id = m;
  if not ok then
    raise exception 'milestones.user_id must remain after project delete';
  end if;
  select user_id = u1 into ok from public.tasks where id = t;
  if not ok then
    raise exception 'tasks.user_id must remain after project delete';
  end if;

  delete from public.milestones where id = m;
  select milestone_id into milestone_id_after from public.tasks where id = t;
  if milestone_id_after is not null then
    raise exception 'tasks.milestone_id should be NULL after milestone delete';
  end if;
  select user_id = u1 into ok from public.tasks where id = t;
  if not ok then
    raise exception 'tasks.user_id must remain after milestone delete';
  end if;
end $$;

rollback;
