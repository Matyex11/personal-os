-- Phase 3 finance ownership / RLS / privilege / CHECK / transfer RPC assertions.
-- Tables: finance_accounts, finance_transactions, trading_pnl_entries.
-- Seeds two auth.users rows inside a transaction and rolls back.
-- AUTHOR ONLY until migration is L3-applied on personal-os-dev
-- (qyysmgwdvhftbgwhpbjt, eu-central-1). Do not run against PROD.
-- Docker stays off unless separately authorized.
-- Authored only — do not claim these tests passed until executed after L3 apply.

begin;

do $$
declare
  u1 uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  u2 uuid := 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  a_ron uuid;
  a_eur uuid;
  a2 uuid;
  a_pnl_only uuid;
  a_empty uuid;
  tx1 uuid;
  pnl1 uuid;
  grp uuid;
  n int;
  bal numeric;
  t text;
  v_state text;
  v_constraint text;
  v_msg text;
begin
  -- Privilege matrix
  foreach t in array array[
    'finance_accounts',
    'finance_transactions',
    'trading_pnl_entries'
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

    if not has_table_privilege('authenticated', format('public.%I', t), 'SELECT')
       or not has_table_privilege('authenticated', format('public.%I', t), 'INSERT')
       or not has_table_privilege('authenticated', format('public.%I', t), 'UPDATE')
    then
      raise exception 'authenticated missing SELECT/INSERT/UPDATE on %', t;
    end if;
  end loop;

  if has_function_privilege(
       'anon',
       'public.create_finance_transfer(uuid,uuid,numeric,date,numeric,date,text)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.create_finance_transfer(uuid,uuid,numeric,date,numeric,date,text)',
       'EXECUTE'
     )
  then
    raise exception 'create_finance_transfer EXECUTE matrix wrong';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values
    (
      '00000000-0000-0000-0000-000000000000', u1, 'authenticated', 'authenticated',
      'phase3-u1@example.com', crypt('x', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    ),
    (
      '00000000-0000-0000-0000-000000000000', u2, 'authenticated', 'authenticated',
      'phase3-u2@example.com', crypt('x', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );

  perform set_config('request.jwt.claim.sub', u1::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  -- Own accounts
  insert into public.finance_accounts (user_id, name, currency, account_kind)
  values (u1, 'RON Cash', 'RON', 'cash')
  returning id into a_ron;

  insert into public.finance_accounts (user_id, name, currency, account_kind)
  values (u1, 'EUR Wallet', 'EUR', 'wallet')
  returning id into a_eur;

  -- Opening balance (inbound +)
  insert into public.finance_transactions (
    user_id, account_id, posted_on, amount, currency, tx_kind
  ) values (
    u1, a_ron, current_date, 1000, 'RON', 'opening_balance'
  )
  returning id into tx1;

  select count(*) into n from public.finance_transactions where id = tx1;
  if n <> 1 then
    raise exception 'own opening_balance insert/select failed';
  end if;

  -- Duplicate opening balance rejected
  begin
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind
    ) values (
      u1, a_ron, current_date, 50, 'RON', 'opening_balance'
    );
    raise exception 'UNEXPECTED_SUCCESS: duplicate opening_balance';
  exception
    when unique_violation then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state is distinct from '23505' then
        raise exception 'expected SQLSTATE 23505 for duplicate opening_balance, got %', v_state;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS%' then raise; end if;
      raise;
  end;

  select count(*) into n
  from public.finance_transactions
  where user_id = u1 and account_id = a_ron and tx_kind = 'opening_balance';
  if n <> 1 then
    raise exception 'opening_balance uniqueness broken (count %)', n;
  end if;

  -- Sign / kind matrix samples
  insert into public.finance_transactions (
    user_id, account_id, posted_on, amount, currency, tx_kind, income_category
  ) values (
    u1, a_ron, current_date, 200, 'RON', 'income', 'employment'
  );

  insert into public.finance_transactions (
    user_id, account_id, posted_on, amount, currency, tx_kind, expense_category
  ) values (
    u1, a_ron, current_date, -40, 'RON', 'expense', 'groceries'
  );

  insert into public.finance_transactions (
    user_id, account_id, posted_on, amount, currency, tx_kind
  ) values (
    u1, a_ron, current_date, -5, 'RON', 'fee'
  );

  begin
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind
    ) values (
      u1, a_ron, current_date, -10, 'RON', 'deposit'
    );
    raise exception 'UNEXPECTED_SUCCESS: negative deposit';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'expected 23514 for negative deposit, got %', v_state;
      end if;
      if v_constraint is distinct from 'finance_transactions_sign_by_kind' then
        raise exception 'expected finance_transactions_sign_by_kind, got %', v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS%' then raise; end if;
      raise;
  end;

  begin
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind, income_category
    ) values (
      u1, a_ron, current_date, 10, 'RON', 'expense', 'employment'
    );
    raise exception 'UNEXPECTED_SUCCESS: income_category on expense';
  exception
    when check_violation then
      get stacked diagnostics
        v_state = returned_sqlstate,
        v_constraint = constraint_name;
      if v_state is distinct from '23514' then
        raise exception 'expected 23514 for income_category on expense, got %', v_state;
      end if;
      if v_constraint is distinct from 'finance_transactions_income_category' then
        raise exception 'expected finance_transactions_income_category, got %', v_constraint;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS%' then raise; end if;
      raise;
  end;

  begin
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind
    ) values (
      u1, a_ron, current_date, 'NaN'::numeric, 'RON', 'other'
    );
    raise exception 'UNEXPECTED_SUCCESS: NaN amount';
  exception
    when check_violation then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state is distinct from '23514' then
        raise exception 'expected 23514 for NaN amount, got %', v_state;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS%' then raise; end if;
      raise;
  end;

  begin
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind
    ) values (
      u1, a_ron, current_date, 10, 'EUR', 'deposit'
    );
    raise exception 'UNEXPECTED_SUCCESS: currency mismatch';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for currency mismatch trigger, got %', v_state;
      end if;
      if v_msg not like 'transaction currency % must equal account currency %' then
        raise exception 'unexpected currency mismatch message: %', v_msg;
      end if;
  end;

  -- Balance includes opening + cash kinds; not computed from PnL
  select coalesce(sum(amount), 0) into bal
  from public.finance_transactions
  where user_id = u1 and account_id = a_ron;
  if bal <> 1000 + 200 - 40 - 5 then
    raise exception 'unexpected cash balance %', bal;
  end if;

  -- Direct transfer insert without RPC GUC rejected (P0001)
  begin
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id
    ) values (
      u1, a_ron, current_date, -10, 'RON', 'transfer',
      gen_random_uuid(), a_eur
    );
    raise exception 'UNEXPECTED_SUCCESS: direct transfer insert';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for direct transfer insert, got %', v_state;
      end if;
      if v_msg not like 'transfer rows must be created via public.create_finance_transfer()%' then
        raise exception 'unexpected direct-transfer message: %', v_msg;
      end if;
  end;

  -- Same-currency transfer via RPC
  insert into public.finance_accounts (user_id, name, currency, account_kind)
  values (u1, 'RON Bank', 'RON', 'bank')
  returning id into a2;

  grp := public.create_finance_transfer(
    a_ron, a2, 100, current_date, null, null, 'same-ccy move'
  );

  select count(*) into n
  from public.finance_transactions
  where user_id = u1 and transfer_group_id = grp and tx_kind = 'transfer';
  if n <> 2 then
    raise exception 'same-ccy transfer must create 2 legs (got %)', n;
  end if;

  select count(*) into n
  from public.finance_transactions
  where transfer_group_id = grp
    and amount = -100
    and account_id = a_ron
    and counterparty_account_id = a2
    and fx_rate is null;
  if n <> 1 then
    raise exception 'same-ccy outgoing leg missing';
  end if;

  select count(*) into n
  from public.finance_transactions
  where transfer_group_id = grp
    and amount = 100
    and account_id = a2
    and counterparty_account_id = a_ron;
  if n <> 1 then
    raise exception 'same-ccy incoming leg missing';
  end if;

  -- Cross-currency user-booked: dest per 1 source
  grp := public.create_finance_transfer(
    a_eur, a_ron, 10, current_date, 5.0, current_date, 'eur->ron'
  );

  select count(*) into n
  from public.finance_transactions
  where transfer_group_id = grp
    and account_id = a_eur
    and amount = -10
    and fx_source = 'user_booked'
    and fx_rate = 5.0;
  if n <> 1 then
    raise exception 'cross-ccy outgoing leg missing';
  end if;

  select count(*) into n
  from public.finance_transactions
  where transfer_group_id = grp
    and account_id = a_ron
    and amount = 50
    and fx_source = 'user_booked';
  if n <> 1 then
    raise exception 'cross-ccy incoming leg missing (expected 50 RON)';
  end if;

  -- Cross-currency without rate must fail atomically (no partial group)
  begin
    perform public.create_finance_transfer(
      a_eur, a_ron, 1, current_date, null, null, 'missing fx'
    );
    raise exception 'UNEXPECTED_SUCCESS: cross-ccy without fx';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for missing FX, got %', v_state;
      end if;
      if v_msg not like 'cross-currency transfer requires user-booked fx_rate%' then
        raise exception 'unexpected missing-FX message: %', v_msg;
      end if;
  end;

  select count(*) into n
  from public.finance_transactions
  where user_id = u1
    and notes = 'missing fx';
  if n <> 0 then
    raise exception 'partial transfer rows leaked after FX failure';
  end if;

  -- Same-currency with FX fields rejected
  begin
    perform public.create_finance_transfer(
      a_ron, a2, 1, current_date, 1.0, current_date, 'bad fx same'
    );
    raise exception 'UNEXPECTED_SUCCESS: same-ccy with fx';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for same-ccy with FX, got %', v_state;
      end if;
      if v_msg not like 'same-currency transfer must not include FX fields%' then
        raise exception 'unexpected same-ccy FX message: %', v_msg;
      end if;
  end;

  -- -----------------------------------------------------------------
  -- DB-wide economic pairing (GUC bypass path) — force IMMEDIATE
  -- -----------------------------------------------------------------

  -- Single transfer leg rejected at deferred→immediate
  begin
    perform set_config('personal_os.finance_transfer_rpc', '1', true);
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id, notes
    ) values (
      u1, a_ron, current_date, -3, 'RON', 'transfer',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', a2, 'single-leg'
    );
    set constraints
      finance_transactions_transfer_group_ins_upd_trg,
      finance_transactions_transfer_group_del_trg
      immediate;
    raise exception 'UNEXPECTED_SUCCESS: single transfer leg';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for single leg, got %', v_state;
      end if;
      if v_msg not like 'transfer_group % must have exactly 2 legs%' then
        raise exception 'unexpected single-leg message: %', v_msg;
      end if;
  end;

  select count(*) into n
  from public.finance_transactions
  where notes = 'single-leg';
  if n <> 0 then
    raise exception 'single-leg transfer leaked after deferred reject';
  end if;

  -- Unequal same-CCY abs amounts rejected
  begin
    perform set_config('personal_os.finance_transfer_rpc', '1', true);
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id, notes
    ) values (
      u1, a_ron, current_date, -10, 'RON', 'transfer',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', a2, 'unequal-abs'
    );
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id, notes
    ) values (
      u1, a2, current_date, 7, 'RON', 'transfer',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', a_ron, 'unequal-abs'
    );
    set constraints
      finance_transactions_transfer_group_ins_upd_trg,
      finance_transactions_transfer_group_del_trg
      immediate;
    raise exception 'UNEXPECTED_SUCCESS: unequal same-ccy amounts';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for unequal abs, got %', v_state;
      end if;
      if v_msg not like 'same-currency transfer_group % amounts must match%' then
        raise exception 'unexpected unequal-abs message: %', v_msg;
      end if;
  end;

  -- Non-reciprocal counterparties rejected
  begin
    perform set_config('personal_os.finance_transfer_rpc', '1', true);
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id, notes
    ) values (
      u1, a_ron, current_date, -4, 'RON', 'transfer',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc', a2, 'non-reciprocal'
    );
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id, notes
    ) values (
      u1, a2, current_date, 4, 'RON', 'transfer',
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc', a_eur, 'non-reciprocal'
    );
    set constraints
      finance_transactions_transfer_group_ins_upd_trg,
      finance_transactions_transfer_group_del_trg
      immediate;
    raise exception 'UNEXPECTED_SUCCESS: non-reciprocal counterparties';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for non-reciprocal, got %', v_state;
      end if;
      if v_msg not like 'transfer_group % counterparties must be reciprocal%' then
        raise exception 'unexpected non-reciprocal message: %', v_msg;
      end if;
  end;

  -- Same-sign pair (two inbound via crafted abs) rejected — both positive impossible
  -- via CHECK if we try two positives with different accounts; use GUC + both + amounts
  begin
    perform set_config('personal_os.finance_transfer_rpc', '1', true);
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id, notes
    ) values (
      u1, a_ron, current_date, 5, 'RON', 'transfer',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', a2, 'same-sign'
    );
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id, notes
    ) values (
      u1, a2, current_date, 5, 'RON', 'transfer',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', a_ron, 'same-sign'
    );
    set constraints
      finance_transactions_transfer_group_ins_upd_trg,
      finance_transactions_transfer_group_del_trg
      immediate;
    raise exception 'UNEXPECTED_SUCCESS: same-sign transfer legs';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for same-sign legs, got %', v_state;
      end if;
      if v_msg not like 'transfer_group % must have one outbound%' then
        raise exception 'unexpected same-sign message: %', v_msg;
      end if;
  end;

  -- Cross-CCY wrong dest amount (not round(src*rate,8)) rejected
  begin
    perform set_config('personal_os.finance_transfer_rpc', '1', true);
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id,
      fx_rate, fx_rate_date, fx_source, notes
    ) values (
      u1, a_eur, current_date, -2, 'EUR', 'transfer',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', a_ron,
      5.0, current_date, 'user_booked', 'bad-fx-amt'
    );
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id,
      fx_rate, fx_rate_date, fx_source, notes
    ) values (
      u1, a_ron, current_date, 9, 'RON', 'transfer',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', a_eur,
      5.0, current_date, 'user_booked', 'bad-fx-amt'
    );
    set constraints
      finance_transactions_transfer_group_ins_upd_trg,
      finance_transactions_transfer_group_del_trg
      immediate;
    raise exception 'UNEXPECTED_SUCCESS: wrong cross-ccy dest amount';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for wrong FX dest, got %', v_state;
      end if;
      if v_msg not like 'cross-currency transfer_group % inbound must equal round%' then
        raise exception 'unexpected wrong-FX-dest message: %', v_msg;
      end if;
  end;

  -- Cross-CCY FX metadata mismatch between legs rejected
  begin
    perform set_config('personal_os.finance_transfer_rpc', '1', true);
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id,
      fx_rate, fx_rate_date, fx_source, notes
    ) values (
      u1, a_eur, current_date, -1, 'EUR', 'transfer',
      'ffffffff-ffff-4fff-8fff-fffffffffff1', a_ron,
      5.0, current_date, 'user_booked', 'fx-meta-mismatch'
    );
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id,
      fx_rate, fx_rate_date, fx_source, notes
    ) values (
      u1, a_ron, current_date, 5, 'RON', 'transfer',
      'ffffffff-ffff-4fff-8fff-fffffffffff1', a_eur,
      4.0, current_date, 'user_booked', 'fx-meta-mismatch'
    );
    set constraints
      finance_transactions_transfer_group_ins_upd_trg,
      finance_transactions_transfer_group_del_trg
      immediate;
    raise exception 'UNEXPECTED_SUCCESS: FX metadata mismatch';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for FX meta mismatch, got %', v_state;
      end if;
      if v_msg not like 'cross-currency transfer_group % requires matching user_booked FX%' then
        raise exception 'unexpected FX-meta message: %', v_msg;
      end if;
  end;

  -- Same-CCY crafted legs carrying FX rejected
  begin
    perform set_config('personal_os.finance_transfer_rpc', '1', true);
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id,
      fx_rate, fx_rate_date, fx_source, notes
    ) values (
      u1, a_ron, current_date, -1, 'RON', 'transfer',
      '11111111-1111-4111-8111-111111111111', a2,
      1.0, current_date, 'user_booked', 'same-ccy-fx'
    );
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind,
      transfer_group_id, counterparty_account_id,
      fx_rate, fx_rate_date, fx_source, notes
    ) values (
      u1, a2, current_date, 1, 'RON', 'transfer',
      '11111111-1111-4111-8111-111111111111', a_ron,
      1.0, current_date, 'user_booked', 'same-ccy-fx'
    );
    set constraints
      finance_transactions_transfer_group_ins_upd_trg,
      finance_transactions_transfer_group_del_trg
      immediate;
    raise exception 'UNEXPECTED_SUCCESS: same-ccy crafted legs with FX';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for same-ccy FX craft, got %', v_state;
      end if;
      if v_msg not like 'same-currency transfer_group % must not carry FX fields%' then
        raise exception 'unexpected same-ccy FX craft message: %', v_msg;
      end if;
  end;

  -- Trading PnL does not change cash balance
  select coalesce(sum(amount), 0) into bal
  from public.finance_transactions
  where user_id = u1 and account_id = a_ron;

  insert into public.trading_pnl_entries (
    user_id, account_id, traded_on, realized_pnl, unrealized_pnl, currency
  ) values (
    u1, a_eur, current_date, 999, 50, 'EUR'
  )
  returning id into pnl1;

  if (
    select coalesce(sum(amount), 0)
    from public.finance_transactions
    where user_id = u1 and account_id = a_ron
  ) is distinct from bal then
    raise exception 'trading PnL mutated cash balance';
  end if;

  -- Multiple PnL rows same traded_on allowed (no daily uniqueness)
  insert into public.trading_pnl_entries (
    user_id, account_id, traded_on, realized_pnl, unrealized_pnl, currency
  ) values (
    u1, a_eur, current_date, 1, 2, 'EUR'
  );

  -- PnL linked-account currency mismatch rejected
  begin
    insert into public.trading_pnl_entries (
      user_id, account_id, traded_on, realized_pnl, unrealized_pnl, currency
    ) values (
      u1, a_eur, current_date, 1, 0, 'RON'
    );
    raise exception 'UNEXPECTED_SUCCESS: PnL currency mismatch';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for PnL currency mismatch, got %', v_state;
      end if;
      if v_msg not like 'trading PnL currency % must equal linked account currency %' then
        raise exception 'unexpected PnL currency message: %', v_msg;
      end if;
  end;

  -- Soft retire account
  update public.finance_accounts
  set is_active = false
  where id = a2 and user_id = u1;

  begin
    perform public.create_finance_transfer(
      a_ron, a2, 1, current_date, null, null, 'to inactive'
    );
    raise exception 'UNEXPECTED_SUCCESS: transfer to inactive account';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for inactive account, got %', v_state;
      end if;
      if v_msg not like '%account is inactive%' then
        raise exception 'unexpected inactive-account message: %', v_msg;
      end if;
  end;

  -- Currency lock after cash txs
  begin
    update public.finance_accounts
    set currency = 'USD'
    where id = a_ron and user_id = u1;
    raise exception 'UNEXPECTED_SUCCESS: currency change after txs';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for currency lock after txs, got %', v_state;
      end if;
      if v_msg not like 'cannot change currency after transactions or linked trading PnL exist%' then
        raise exception 'unexpected currency-lock (txs) message: %', v_msg;
      end if;
  end;

  -- Currency lock after linked PnL only (no cash txs on that account)
  insert into public.finance_accounts (user_id, name, currency, account_kind)
  values (u1, 'PnL Only Broker', 'USD', 'brokerage')
  returning id into a_pnl_only;

  insert into public.trading_pnl_entries (
    user_id, account_id, traded_on, realized_pnl, unrealized_pnl, currency
  ) values (
    u1, a_pnl_only, current_date, 10, 0, 'USD'
  );

  begin
    update public.finance_accounts
    set currency = 'EUR'
    where id = a_pnl_only and user_id = u1;
    raise exception 'UNEXPECTED_SUCCESS: currency change after linked PnL only';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for currency lock after PnL, got %', v_state;
      end if;
      if v_msg not like 'cannot change currency after transactions or linked trading PnL exist%' then
        raise exception 'unexpected currency-lock (PnL) message: %', v_msg;
      end if;
  end;

  -- Empty account (no txs, no linked PnL) may still change currency
  insert into public.finance_accounts (user_id, name, currency, account_kind)
  values (u1, 'Fresh Empty', 'GBP', 'other')
  returning id into a_empty;

  update public.finance_accounts
  set currency = 'CHF'
  where id = a_empty and user_id = u1;

  if (
    select currency from public.finance_accounts where id = a_empty
  ) is distinct from 'CHF' then
    raise exception 'empty account currency change should succeed';
  end if;

  -- Cash-tx enforce path: match new currency (FOR SHARE lookup); reject stale CCY
  insert into public.finance_transactions (
    user_id, account_id, posted_on, amount, currency, tx_kind
  ) values (
    u1, a_empty, current_date, 25, 'CHF', 'deposit'
  );

  begin
    insert into public.finance_transactions (
      user_id, account_id, posted_on, amount, currency, tx_kind
    ) values (
      u1, a_empty, current_date, 1, 'GBP', 'deposit'
    );
    raise exception 'UNEXPECTED_SUCCESS: cash tx stale currency after account CCY change';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      if v_state is distinct from 'P0001' then
        raise exception 'expected P0001 for stale cash-tx currency, got %', v_state;
      end if;
      if v_msg not like 'transaction currency % must equal account currency %' then
        raise exception 'unexpected stale cash-tx currency message: %', v_msg;
      end if;
  end;

  -- Authenticated DELETE denied
  begin
    delete from public.finance_accounts where id = a_ron;
    raise exception 'UNEXPECTED_SUCCESS: authenticated DELETE account';
  exception
    when insufficient_privilege then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state is distinct from '42501' then
        raise exception 'expected 42501 for DELETE account, got %', v_state;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS%' then raise; end if;
      raise;
  end;

  begin
    delete from public.finance_transactions where id = tx1;
    raise exception 'UNEXPECTED_SUCCESS: authenticated DELETE transaction';
  exception
    when insufficient_privilege then
      get stacked diagnostics v_state = returned_sqlstate;
      if v_state is distinct from '42501' then
        raise exception 'expected 42501 for DELETE transaction, got %', v_state;
      end if;
    when raise_exception then
      if sqlerrm like 'UNEXPECTED_SUCCESS%' then raise; end if;
      raise;
  end;

  -- Cross-user SELECT/INSERT denial
  reset role;
  perform set_config('request.jwt.claim.sub', u2::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;

  select count(*) into n from public.finance_accounts where id = a_ron;
  if n <> 0 then
    raise exception 'cross-user SELECT must return 0 accounts (got %)', n;
  end if;

  select count(*) into n from public.finance_transactions where id = tx1;
  if n <> 0 then
    raise exception 'cross-user SELECT must return 0 txs (got %)', n;
  end if;

  select count(*) into n from public.trading_pnl_entries where id = pnl1;
  if n <> 0 then
    raise exception 'cross-user SELECT must return 0 pnl (got %)', n;
  end if;

  begin
    insert into public.finance_accounts (user_id, name, currency, account_kind)
    values (u1, 'hijack', 'RON', 'cash');
    raise exception 'UNEXPECTED_SUCCESS: cross-user account INSERT';
  exception
    when raise_exception then
      get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
      if v_msg like 'UNEXPECTED_SUCCESS%' then raise; end if;
      -- RLS with check → typically 42501 or P0001 depending on PG/Supabase
      if v_state not in ('42501', 'P0001') then
        raise exception 'expected 42501/P0001 for cross-user INSERT, got %', v_state;
      end if;
  end;

  begin
    update public.finance_transactions set amount = 1 where id = tx1;
    null;
  end;

  if exists (select 1 from public.finance_transactions where id = tx1) then
    raise exception 'u2 must not see u1 tx for update attempt verification';
  end if;

  reset role;
  perform set_config('request.jwt.claim.sub', u1::text, true);
  set local role authenticated;

  if (
    select amount from public.finance_transactions where id = tx1
  ) is distinct from 1000 then
    raise exception 'cross-user UPDATE must not alter opening balance';
  end if;

  raise notice 'phase3 finance ownership/RLS/transfer checks passed (authored; not a live proof)';
end $$;

rollback;
