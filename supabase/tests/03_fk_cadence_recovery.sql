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
  log_id uuid;
  chapter_id_after uuid;
  project_id_after uuid;
  milestone_id_after uuid;
  ok boolean;
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

  insert into public.chapters (id, user_id, title, started_on, status, is_current)
  values (gen_random_uuid(), u1, 'FK chapter', current_date, 'active', true)
  returning id into ch;

  -- Valid cadence
  insert into public.habits (user_id, chapter_id, name, cadence, min_value, target_value)
  values (
    u1, ch, 'Valid',
    '{"kind":"daily","startOn":"2026-11-01"}'::jsonb,
    1, 1
  ) returning id into h;

  -- Invalid cadence kinds / weekdays / ranges
  begin
    insert into public.habits (user_id, name, cadence, min_value, target_value)
    values (u1, 'bad kind', '{"kind":"hourly","startOn":"2026-11-01"}'::jsonb, 1, 1);
    raise exception 'invalid cadence kind must fail';
  exception when check_violation then null;
    when others then
      if sqlerrm like '%cadence kind must fail%' then raise; end if;
      null;
  end;

  begin
    insert into public.habits (user_id, name, cadence, min_value, target_value)
    values (u1, 'empty weekdays', '{"kind":"weekdays","weekdays":[],"startOn":"2026-11-01"}'::jsonb, 1, 1);
    raise exception 'empty weekdays must fail';
  exception when check_violation then null;
    when others then
      if sqlerrm like '%empty weekdays must fail%' then raise; end if;
      null;
  end;

  begin
    insert into public.habits (user_id, name, cadence, min_value, target_value)
    values (u1, 'bad weekday', '{"kind":"weekdays","weekdays":[0,8],"startOn":"2026-11-01"}'::jsonb, 1, 1);
    raise exception 'invalid ISO weekdays must fail';
  exception when check_violation then null;
    when others then
      if sqlerrm like '%ISO weekdays must fail%' then raise; end if;
      null;
  end;

  begin
    insert into public.habits (user_id, name, cadence, min_value, target_value)
    values (u1, 'bad range', '{"kind":"daily","startOn":"2026-11-10","endOn":"2026-11-01"}'::jsonb, 1, 1);
    raise exception 'invalid date range must fail';
  exception when check_violation then null;
    when others then
      if sqlerrm like '%date range must fail%' then raise; end if;
      null;
  end;

  begin
    insert into public.habits (user_id, name, cadence, min_value, target_value)
    values (u1, 'neg min', '{"kind":"daily","startOn":"2026-11-01"}'::jsonb, -1, 1);
    raise exception 'min_value < 0 must fail';
  exception when check_violation then null;
    when others then
      if sqlerrm like '%min_value%' then raise; end if;
      null;
  end;

  -- Cross-user chapter FK
  begin
    insert into public.habits (user_id, chapter_id, name, cadence, min_value, target_value)
    values (u2, ch, 'cross', '{"kind":"daily","startOn":"2026-11-01"}'::jsonb, 1, 1);
    raise exception 'cross-user chapter FK must fail';
  exception when foreign_key_violation then null;
    when others then
      if sqlerrm like '%cross-user chapter FK%' then raise; end if;
      null;
  end;

  insert into public.projects (user_id, chapter_id, title)
  values (u1, ch, 'P') returning id into p;
  insert into public.milestones (user_id, project_id, title)
  values (u1, p, 'M') returning id into m;
  insert into public.tasks (user_id, project_id, milestone_id, title)
  values (u1, p, m, 'T') returning id into t;

  insert into public.habit_logs (user_id, habit_id, logged_on, status, value)
  values (u1, h, current_date, 'missed', null)
  returning id into log_id;

  begin
    insert into public.habit_logs (user_id, habit_id, logged_on, status, value)
    values (u1, h, current_date - 1, 'completed', -5);
    raise exception 'negative habit_logs.value must fail';
  exception when check_violation then null;
    when others then
      if sqlerrm like '%habit_logs.value%' then raise; end if;
      null;
  end;

  -- Recovery targeting completed must fail
  insert into public.habit_logs (user_id, habit_id, logged_on, status)
  values (u1, h, current_date - 2, 'completed');
  -- find that completed id
  select id into log_id from public.habit_logs
  where habit_id = h and status = 'completed' limit 1;

  begin
    insert into public.habit_logs (user_id, habit_id, logged_on, status, recovers_log_id)
    values (u1, h, current_date, 'recovery', log_id);
    raise exception 'recovery on completed must fail';
  exception when raise_exception then
    if sqlerrm like '%recovery on completed must fail%' then raise; end if;
    null; -- trigger raised expected message
  when others then null;
  end;

  -- Valid recovery on missed
  select id into log_id from public.habit_logs
  where habit_id = h and status = 'missed' limit 1;

  insert into public.habit_logs (user_id, habit_id, logged_on, status, recovers_log_id)
  values (u1, h, current_date + 1, 'recovery', log_id);

  -- Cannot rewrite original missed status
  begin
    update public.habit_logs set status = 'completed' where id = log_id;
    raise exception 'rewriting missed status must fail';
  exception when raise_exception then
    if sqlerrm like '%rewriting missed status must fail%' then raise; end if;
    null;
  when others then null;
  end;

  -- Habit delete restricted while logs exist
  begin
    delete from public.habits where id = h;
    raise exception 'habit delete with logs must RESTRICT';
  exception when foreign_key_violation then null;
    when others then
      if sqlerrm like '%RESTRICT%' then raise; end if;
      null;
  end;

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

  delete from public.projects where id = p;
  select project_id into project_id_after from public.milestones where id = m;
  select project_id into project_id_after from public.tasks where id = t;
  if project_id_after is not null then
    raise exception 'tasks.project_id should be NULL after project delete';
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
end $$;

rollback;
