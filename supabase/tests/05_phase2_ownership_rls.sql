-- Phase 2 ownership / RLS / privilege / CHECK assertions for
-- check_ins, reviews, physical_metrics.
-- Seeds two auth.users rows inside a transaction and rolls back.
-- AUTHOR ONLY until migration is L3-applied on personal-os-dev
-- (qyysmgwdvhftbgwhpbjt, eu-central-1). Do not run against PROD.
-- Docker stays off unless separately authorized.
-- Expanded after SQL review: per-key physical bounds, NaN/inf rejection,
-- broader negative CHECK coverage, cross-user UPDATE denial.

begin;

do $$
declare
  u1 uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  u2 uuid := 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  ch1 uuid;
  ch2 uuid;
  ci1 uuid;
  rev1 uuid;
  pm1 uuid;
  n int;
  t text;
  v_state text;
  v_constraint text;
begin
  -- Privilege matrix (anon none; authenticated SELECT/INSERT/UPDATE; no DELETE)
  foreach t in array array['check_ins', 'reviews', 'physical_metrics']
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

    if not has_table_privilege('authenticated', format('public.%I', t), 'SELECT')
       or not has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       or not has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
    then
      raise exception 'authenticated missing SELECT/INSERT/UPDATE on %', t;
    end if;
  end loop;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values
    (
      '00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
      'phase2-u1@example.com', crypt('x', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
      'phase2-u2@example.com', crypt('x', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

  perform set_config('request.jwt.claim.sub', u1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  insert into public.chapters (user_id, title, started_on, status, is_current)
  values (u1, 'P2 U1 chapter', current_date, 'active', true)
  returning id into ch1;

  -- Own-record INSERT/SELECT: check_ins
  insert into public.check_ins (
    user_id, chapter_id, checked_on, mood, energy, focus, body
  ) values (
    u1, ch1, current_date, 4, 3, 5, 'ok day'
  )
  returning id into ci1;

  select count(*) into n from public.check_ins where id = ci1;
  if n <> 1 then
    raise exception 'own-record SELECT/INSERT failed for check_ins (got %)', n;
  end if;

  -- Own-record INSERT/SELECT: reviews (draft)
  insert into public.reviews (
    user_id, chapter_id, period_kind, period_start, period_end, status, answers
  ) values (
    u1, ch1, 'weekly', current_date - 6, current_date, 'draft', '{"wins":"shipped"}'::jsonb
  )
  returning id into rev1;

  select count(*) into n from public.reviews where id = rev1;
  if n <> 1 then
    raise exception 'own-record SELECT/INSERT failed for reviews (got %)', n;
  end if;

  -- Own-record INSERT/SELECT: physical_metrics (in-range weight)
  insert into public.physical_metrics (
    user_id, recorded_on, metric_key, value, unit, notes
  ) values (
    u1, current_date, 'weight_kg', 72.5, 'kg', null
  )
  returning id into pm1;

  select count(*) into n from public.physical_metrics where id = pm1;
  if n <> 1 then
    raise exception 'own-record SELECT/INSERT failed for physical_metrics (got %)', n;
  end if;

  -- Boundary-valid inserts for remaining catalog keys (different days)
  insert into public.physical_metrics (user_id, recorded_on, metric_key, value, unit)
  values
    (u1, current_date - 1, 'sleep_hours', 0, 'hours'),
    (u1, current_date - 1, 'steps', 0, 'count'),
    (u1, current_date - 1, 'resting_hr_bpm', 20, 'bpm'),
    (u1, current_date - 1, 'workout_minutes', 0, 'minutes'),
    (u1, current_date - 2, 'sleep_hours', 24, 'hours'),
    (u1, current_date - 2, 'steps', 200000, 'count'),
    (u1, current_date - 2, 'resting_hr_bpm', 250, 'bpm'),
    (u1, current_date - 2, 'workout_minutes', 1440, 'minutes'),
    (u1, current_date - 3, 'weight_kg', 0.1, 'kg'),
    (u1, current_date - 4, 'weight_kg', 500, 'kg');

  -- Own UPDATE paths
  update public.check_ins set mood = 5, updated_at = now() where id = ci1;
  if not found then
    raise exception 'own UPDATE failed for check_ins';
  end if;

  update public.reviews
    set status = 'completed', completed_at = now(), updated_at = now()
  where id = rev1;
  if not found then
    raise exception 'own UPDATE failed for reviews complete transition';
  end if;

  update public.physical_metrics set value = 72.0, updated_at = now() where id = pm1;
  if not found then
    raise exception 'own UPDATE failed for physical_metrics';
  end if;

  -- Cross-user INSERT denied (RLS → insufficient_privilege)
  begin
    insert into public.check_ins (user_id, checked_on, mood, energy, focus)
    values (u2, current_date, 1, 1, 1);
    raise exception 'UNEXPECTED_SUCCESS: cross-user check_ins INSERT';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.reviews (
      user_id, period_kind, period_start, period_end, status
    ) values (u2, 'weekly', current_date - 6, current_date, 'draft');
    raise exception 'UNEXPECTED_SUCCESS: cross-user reviews INSERT';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u2, current_date, 'steps', 1000, 'count');
    raise exception 'UNEXPECTED_SUCCESS: cross-user physical_metrics INSERT';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Cross-user SELECT + UPDATE: switch to u2
  reset role;
  perform set_config('request.jwt.claim.sub', u2::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into n from public.check_ins where id = ci1;
  if n <> 0 then
    raise exception 'cross-user SELECT must return 0 check_ins (got %)', n;
  end if;

  select count(*) into n from public.reviews where id = rev1;
  if n <> 0 then
    raise exception 'cross-user SELECT must return 0 reviews (got %)', n;
  end if;

  select count(*) into n from public.physical_metrics where id = pm1;
  if n <> 0 then
    raise exception 'cross-user SELECT must return 0 physical_metrics (got %)', n;
  end if;

  -- Cross-user UPDATE must affect 0 rows (RLS USING)
  update public.check_ins set mood = 1 where id = ci1;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'cross-user UPDATE must affect 0 check_ins (got %)', n;
  end if;

  update public.reviews set narrative = 'stolen' where id = rev1;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'cross-user UPDATE must affect 0 reviews (got %)', n;
  end if;

  update public.physical_metrics set value = 99 where id = pm1;
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception 'cross-user UPDATE must affect 0 physical_metrics (got %)', n;
  end if;

  -- u2 own seed (for composite FK cross-user chapter attempt later)
  insert into public.chapters (user_id, title, started_on, status, is_current)
  values (u2, 'P2 U2 chapter', current_date, 'active', true)
  returning id into ch2;

  -- Hard DELETE unavailable (no GRANT) — attempt as u1
  reset role;
  perform set_config('request.jwt.claim.sub', u1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  begin
    delete from public.check_ins where id = ci1;
    raise exception 'UNEXPECTED_SUCCESS: authenticated DELETE on check_ins';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    delete from public.reviews where id = rev1;
    raise exception 'UNEXPECTED_SUCCESS: authenticated DELETE on reviews';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    delete from public.physical_metrics where id = pm1;
    raise exception 'UNEXPECTED_SUCCESS: authenticated DELETE on physical_metrics';
  exception
    when insufficient_privilege then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- -------------------------------------------------------------------------
  -- CHECK / UNIQUE denials (still as u1)
  -- -------------------------------------------------------------------------

  -- check_ins score ranges
  begin
    insert into public.check_ins (user_id, checked_on, mood, energy, focus)
    values (u1, current_date + 1, 0, 3, 3);
    raise exception 'UNEXPECTED_SUCCESS: mood out of range';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.check_ins (user_id, checked_on, mood, energy, focus)
    values (u1, current_date + 2, 3, 6, 3);
    raise exception 'UNEXPECTED_SUCCESS: energy out of range';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.check_ins (user_id, checked_on, mood, energy, focus)
    values (u1, current_date + 3, 3, 3, 0);
    raise exception 'UNEXPECTED_SUCCESS: focus out of range';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.check_ins (user_id, checked_on, mood, energy, focus)
    values (u1, current_date, 2, 2, 2);
    raise exception 'UNEXPECTED_SUCCESS: duplicate check_ins day';
  exception
    when unique_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23505' then
        raise exception 'duplicate check_ins day: expected SQLSTATE 23505 got %', v_state;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- check_ins body length: null OK; <=2000 OK; 2001 rejected (23514 / check_ins_body_length)
  insert into public.check_ins (
    user_id, checked_on, mood, energy, focus, body
  ) values (u1, current_date + 50, 3, 3, 3, null);

  insert into public.check_ins (
    user_id, checked_on, mood, energy, focus, body
  ) values (u1, current_date + 51, 3, 3, 3, repeat('b', 2000));

  begin
    insert into public.check_ins (
      user_id, checked_on, mood, energy, focus, body
    ) values (u1, current_date + 52, 3, 3, 3, repeat('b', 2001));
    raise exception 'UNEXPECTED_SUCCESS: body longer than 2000';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'body length: expected SQLSTATE 23514 got %', v_state;
      end if;
      if v_constraint is distinct from 'check_ins_body_length' then
        raise exception 'body length: expected constraint check_ins_body_length got %',
          v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- prompt_set_key: must be 'v1_simple' (CHECK check_ins_prompt_set_key_v1_simple).
  -- Omit → default; explicit v1_simple OK; empty/whitespace/v2/NULL rejected.
  insert into public.check_ins (
    user_id, checked_on, mood, energy, focus
  ) values (u1, current_date + 53, 3, 3, 3);
  -- omit uses default 'v1_simple'
  select prompt_set_key into t from public.check_ins
    where user_id = u1 and checked_on = current_date + 53;
  if t is distinct from 'v1_simple' then
    raise exception 'omit prompt_set_key must default to v1_simple (got %)', t;
  end if;

  insert into public.check_ins (
    user_id, checked_on, mood, energy, focus, prompt_set_key
  ) values (u1, current_date + 54, 3, 3, 3, 'v1_simple');

  begin
    insert into public.check_ins (
      user_id, checked_on, mood, energy, focus, prompt_set_key
    ) values (u1, current_date + 55, 3, 3, 3, '');
    raise exception 'UNEXPECTED_SUCCESS: empty prompt_set_key';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'empty prompt_set_key: expected SQLSTATE 23514 got %', v_state;
      end if;
      if v_constraint is distinct from 'check_ins_prompt_set_key_v1_simple' then
        raise exception
          'empty prompt_set_key: expected constraint check_ins_prompt_set_key_v1_simple got %',
          v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.check_ins (
      user_id, checked_on, mood, energy, focus, prompt_set_key
    ) values (u1, current_date + 56, 3, 3, 3, '   ');
    raise exception 'UNEXPECTED_SUCCESS: whitespace prompt_set_key';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'whitespace prompt_set_key: expected SQLSTATE 23514 got %', v_state;
      end if;
      if v_constraint is distinct from 'check_ins_prompt_set_key_v1_simple' then
        raise exception
          'whitespace prompt_set_key: expected constraint check_ins_prompt_set_key_v1_simple got %',
          v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.check_ins (
      user_id, checked_on, mood, energy, focus, prompt_set_key
    ) values (u1, current_date + 57, 3, 3, 3, 'v2_unsupported');
    raise exception 'UNEXPECTED_SUCCESS: v2_unsupported prompt_set_key';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'v2_unsupported prompt_set_key: expected SQLSTATE 23514 got %', v_state;
      end if;
      if v_constraint is distinct from 'check_ins_prompt_set_key_v1_simple' then
        raise exception
          'v2_unsupported prompt_set_key: expected constraint check_ins_prompt_set_key_v1_simple got %',
          v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.check_ins (
      user_id, checked_on, mood, energy, focus, prompt_set_key
    ) values (u1, current_date + 58, 3, 3, 3, null);
    raise exception 'UNEXPECTED_SUCCESS: NULL prompt_set_key';
  exception
    when not_null_violation then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state is distinct from '23502' then
        raise exception 'NULL prompt_set_key: expected SQLSTATE 23502 got %', v_state;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Cross-user chapter composite FK (u1 cannot attach u2 chapter)
  begin
    insert into public.check_ins (
      user_id, chapter_id, checked_on, mood, energy, focus
    ) values (u1, ch2, current_date + 10, 3, 3, 3);
    raise exception 'UNEXPECTED_SUCCESS: cross-user chapter FK on check_ins';
  exception
    when foreign_key_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.reviews (
      user_id, chapter_id, period_kind, period_start, period_end, status
    ) values (
      u1, ch2, 'custom', current_date + 10, current_date + 10, 'draft'
    );
    raise exception 'UNEXPECTED_SUCCESS: cross-user chapter FK on reviews';
  exception
    when foreign_key_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- reviews consistency / uniqueness
  begin
    insert into public.reviews (
      user_id, period_kind, period_start, period_end, status, completed_at
    ) values (
      u1, 'weekly', current_date - 13, current_date - 7, 'completed', null
    );
    raise exception 'UNEXPECTED_SUCCESS: completed without completed_at';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.reviews (
      user_id, period_kind, period_start, period_end, status, completed_at
    ) values (
      u1, 'weekly', current_date - 20, current_date - 14, 'draft', now()
    );
    raise exception 'UNEXPECTED_SUCCESS: draft with completed_at';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.reviews (
      user_id, period_kind, period_start, period_end, status
    ) values (
      u1, 'weekly', current_date, current_date - 1, 'draft'
    );
    raise exception 'UNEXPECTED_SUCCESS: period_start after period_end';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.reviews (
      user_id, period_kind, period_start, period_end, status
    ) values (
      u1, 'weekly', current_date - 6, current_date, 'draft'
    );
    raise exception 'UNEXPECTED_SUCCESS: duplicate reviews period';
  exception
    when unique_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23505' then
        raise exception 'duplicate reviews period: expected SQLSTATE 23505 got %', v_state;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- reviews.answers must be JSON object: {} valid; array/scalar/null rejected
  -- (23514 / reviews_answers_object)
  insert into public.reviews (
    user_id, period_kind, period_start, period_end, status, answers
  ) values (
    u1, 'custom', current_date - 40, current_date - 40, 'draft', '{}'::jsonb
  );

  begin
    insert into public.reviews (
      user_id, period_kind, period_start, period_end, status, answers
    ) values (
      u1, 'custom', current_date - 41, current_date - 41, 'draft', '[]'::jsonb
    );
    raise exception 'UNEXPECTED_SUCCESS: answers array';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'answers array: expected SQLSTATE 23514 got %', v_state;
      end if;
      if v_constraint is distinct from 'reviews_answers_object' then
        raise exception 'answers array: expected constraint reviews_answers_object got %',
          v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.reviews (
      user_id, period_kind, period_start, period_end, status, answers
    ) values (
      u1, 'custom', current_date - 42, current_date - 42, 'draft', '1'::jsonb
    );
    raise exception 'UNEXPECTED_SUCCESS: answers scalar';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'answers scalar: expected SQLSTATE 23514 got %', v_state;
      end if;
      if v_constraint is distinct from 'reviews_answers_object' then
        raise exception 'answers scalar: expected constraint reviews_answers_object got %',
          v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.reviews (
      user_id, period_kind, period_start, period_end, status, answers
    ) values (
      u1, 'custom', current_date - 43, current_date - 43, 'draft', 'null'::jsonb
    );
    raise exception 'UNEXPECTED_SUCCESS: answers json null';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'answers null: expected SQLSTATE 23514 got %', v_state;
      end if;
      if v_constraint is distinct from 'reviews_answers_object' then
        raise exception 'answers null: expected constraint reviews_answers_object got %',
          v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- physical: unit mismatch
  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 1, 'weight_kg', 70, 'hours');
    raise exception 'UNEXPECTED_SUCCESS: metric_key/unit mismatch';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- physical: unknown metric_key
  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 1, 'body_fat_pct', 20, 'percent');
    raise exception 'UNEXPECTED_SUCCESS: unknown metric_key';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- physical: duplicate (user, key, day)
  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date, 'weight_kg', 71, 'kg');
    raise exception 'UNEXPECTED_SUCCESS: duplicate physical metric day';
  exception
    when unique_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- physical: per-key out-of-range (below / above)
  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 20, 'weight_kg', 0.09, 'kg');
    raise exception 'UNEXPECTED_SUCCESS: weight_kg below min';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 21, 'weight_kg', 500.1, 'kg');
    raise exception 'UNEXPECTED_SUCCESS: weight_kg above max';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 22, 'sleep_hours', -0.1, 'hours');
    raise exception 'UNEXPECTED_SUCCESS: sleep_hours below min';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 23, 'sleep_hours', 24.1, 'hours');
    raise exception 'UNEXPECTED_SUCCESS: sleep_hours above max';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 24, 'steps', -1, 'count');
    raise exception 'UNEXPECTED_SUCCESS: steps below min';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 25, 'steps', 200001, 'count');
    raise exception 'UNEXPECTED_SUCCESS: steps above max';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 26, 'steps', 10.5, 'count');
    raise exception 'UNEXPECTED_SUCCESS: steps non-integer';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 27, 'resting_hr_bpm', 19, 'bpm');
    raise exception 'UNEXPECTED_SUCCESS: resting_hr_bpm below min';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 28, 'resting_hr_bpm', 251, 'bpm');
    raise exception 'UNEXPECTED_SUCCESS: resting_hr_bpm above max';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 29, 'resting_hr_bpm', 60.5, 'bpm');
    raise exception 'UNEXPECTED_SUCCESS: resting_hr_bpm non-integer';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 30, 'workout_minutes', -1, 'minutes');
    raise exception 'UNEXPECTED_SUCCESS: workout_minutes below min';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 31, 'workout_minutes', 1441, 'minutes');
    raise exception 'UNEXPECTED_SUCCESS: workout_minutes above max';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 32, 'workout_minutes', 30.25, 'minutes');
    raise exception 'UNEXPECTED_SUCCESS: workout_minutes non-integer';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- physical: NaN / ±Infinity rejected
  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 40, 'weight_kg', 'NaN'::numeric, 'kg');
    raise exception 'UNEXPECTED_SUCCESS: weight_kg NaN';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 41, 'sleep_hours', 'Infinity'::numeric, 'hours');
    raise exception 'UNEXPECTED_SUCCESS: sleep_hours Infinity';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  begin
    insert into public.physical_metrics (
      user_id, recorded_on, metric_key, value, unit
    ) values (u1, current_date + 42, 'steps', '-Infinity'::numeric, 'count');
    raise exception 'UNEXPECTED_SUCCESS: steps -Infinity';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Out-of-range UPDATE on existing row must fail CHECK
  begin
    update public.physical_metrics set value = 0 where id = pm1;
    raise exception 'UNEXPECTED_SUCCESS: UPDATE weight_kg below min';
  exception
    when check_violation then null;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS:%' then raise; end if;
      raise;
  end;

  -- Chapter SET NULL (col) on privileged chapter delete (reset to bypass RLS)
  reset role;
  delete from public.chapters where id = ch1;

  select chapter_id into ch1 from public.check_ins where id = ci1;
  if ch1 is not null then
    raise exception 'check_ins.chapter_id must SET NULL after chapter delete';
  end if;

  select chapter_id into ch1 from public.reviews where id = rev1;
  if ch1 is not null then
    raise exception 'reviews.chapter_id must SET NULL after chapter delete';
  end if;

  -- Account purge: Phase 2 rows cascade with auth.users
  delete from auth.users where id = u1;
  set constraints all immediate;

  select count(*) into n from public.check_ins where user_id = u1;
  if n <> 0 then raise exception 'orphan check_ins after account delete: %', n; end if;

  select count(*) into n from public.reviews where user_id = u1;
  if n <> 0 then raise exception 'orphan reviews after account delete: %', n; end if;

  select count(*) into n from public.physical_metrics where user_id = u1;
  if n <> 0 then raise exception 'orphan physical_metrics after account delete: %', n; end if;

  reset role;
end $$;

rollback;
