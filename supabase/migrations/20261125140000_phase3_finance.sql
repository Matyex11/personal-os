-- Phase 3 P3-M0 schema DRAFT for personal-os-dev (qyysmgwdvhftbgwhpbjt, eu-central-1).
-- Tables: finance_accounts, finance_transactions, trading_pnl_entries
-- + atomic transfer RPC create_finance_transfer.
-- DO NOT APPLY until separate human L3 approval on the named DEV project.
-- Does not ALTER Phase 1B/2 tables, Auth, or existing RLS/policies.
-- Privilege matrix: authenticated SELECT/INSERT/UPDATE own; no DELETE; anon none.
-- Semantics: docs/phase-3-architecture-plan.md (approved decisions locked).
-- Transfer integrity: deferred constraint trigger enforces economic pairing
-- database-wide; GUC personal_os.finance_transfer_rpc only gates transfer INSERT
-- (app path via RPC) — it is not the economic guarantee.

-- ---------------------------------------------------------------------------
-- finance_accounts
-- ---------------------------------------------------------------------------

create table public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  currency text not null,
  account_kind text not null,
  is_sensitive boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint finance_accounts_name_nonempty check (length(btrim(name)) > 0),
  constraint finance_accounts_name_length check (char_length(name) <= 200),
  constraint finance_accounts_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint finance_accounts_kind check (
    account_kind in ('cash', 'bank', 'brokerage', 'wallet', 'other')
  ),
  constraint finance_accounts_notes_length check (
    notes is null or char_length(notes) <= 2000
  )
);

create index finance_accounts_user_active_idx
  on public.finance_accounts (user_id, is_active);

alter table public.finance_accounts enable row level security;

create policy finance_accounts_select_own on public.finance_accounts
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy finance_accounts_insert_own on public.finance_accounts
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy finance_accounts_update_own on public.finance_accounts
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No DELETE policy for authenticated clients (soft retire via is_active).

-- ---------------------------------------------------------------------------
-- finance_transactions
-- ---------------------------------------------------------------------------

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null,
  posted_on date not null,
  amount numeric not null,
  currency text not null,
  tx_kind text not null,
  income_category text,
  expense_category text,
  transfer_group_id uuid,
  counterparty_account_id uuid,
  fx_rate numeric,
  fx_rate_date date,
  fx_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint finance_transactions_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint finance_transactions_amount_finite check (
    lower(btrim(amount::text)) not in ('nan', 'infinity', '-infinity')
  ),
  constraint finance_transactions_amount_nonzero check (amount <> 0),
  constraint finance_transactions_kind check (
    tx_kind in (
      'opening_balance',
      'deposit',
      'withdrawal',
      'transfer',
      'income',
      'expense',
      'business_revenue',
      'business_cost',
      'fee',
      'other'
    )
  ),
  -- Sign-by-kind: inbound +, outbound −; opening_balance/other either non-zero.
  constraint finance_transactions_sign_by_kind check (
    (
      tx_kind in ('deposit', 'income', 'business_revenue')
      and amount > 0
    )
    or (
      tx_kind in ('withdrawal', 'expense', 'business_cost', 'fee')
      and amount < 0
    )
    or (
      tx_kind = 'transfer'
      and amount <> 0
    )
    or (
      tx_kind in ('opening_balance', 'other')
      and amount <> 0
    )
  ),
  constraint finance_transactions_income_category check (
    (
      tx_kind = 'income'
      and income_category in ('employment', 'freelance', 'business', 'other')
    )
    or (
      tx_kind <> 'income'
      and income_category is null
    )
  ),
  constraint finance_transactions_expense_category check (
    (
      tx_kind = 'expense'
      and (
        expense_category is null
        or (
          length(btrim(expense_category)) > 0
          and char_length(expense_category) <= 200
        )
      )
    )
    or (
      tx_kind <> 'expense'
      and expense_category is null
    )
  ),
  constraint finance_transactions_transfer_fields check (
    (
      tx_kind = 'transfer'
      and transfer_group_id is not null
      and counterparty_account_id is not null
      and counterparty_account_id is distinct from account_id
    )
    or (
      tx_kind <> 'transfer'
      and transfer_group_id is null
      and counterparty_account_id is null
      and fx_rate is null
      and fx_rate_date is null
      and fx_source is null
    )
  ),
  constraint finance_transactions_fx_finite check (
    fx_rate is null
    or (
      lower(btrim(fx_rate::text)) not in ('nan', 'infinity', '-infinity')
      and fx_rate > 0
    )
  ),
  -- Non-transfer rows never carry FX; transfer FX nullness/consistency is
  -- enforced in create_finance_transfer (same-CCY vs cross-CCY).
  constraint finance_transactions_fx_bundle check (
    (
      fx_rate is null
      and fx_rate_date is null
      and fx_source is null
    )
    or (
      fx_rate is not null
      and fx_rate_date is not null
      and fx_source = 'user_booked'
      and tx_kind = 'transfer'
    )
  ),
  constraint finance_transactions_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  -- Account ownership FKs: NO ACTION DEFERRABLE so whole-user purge via
  -- auth.users CASCADE still completes; individual account DELETE stays blocked
  -- while dependent rows exist (authenticated has no DELETE grant anyway).
  constraint finance_transactions_account_fkey
    foreign key (user_id, account_id)
    references public.finance_accounts (user_id, id)
    on delete no action
    deferrable initially deferred,
  constraint finance_transactions_counterparty_fkey
    foreign key (user_id, counterparty_account_id)
    references public.finance_accounts (user_id, id)
    on delete no action
    deferrable initially deferred
);

-- One opening_balance row per account.
create unique index finance_transactions_opening_balance_unique
  on public.finance_transactions (user_id, account_id)
  where tx_kind = 'opening_balance';

-- At most one transfer leg per account within a transfer group.
create unique index finance_transactions_transfer_group_account_unique
  on public.finance_transactions (user_id, transfer_group_id, account_id)
  where tx_kind = 'transfer';

create index finance_transactions_user_account_posted_idx
  on public.finance_transactions (user_id, account_id, posted_on);

create index finance_transactions_user_posted_idx
  on public.finance_transactions (user_id, posted_on);

create index finance_transactions_user_kind_posted_idx
  on public.finance_transactions (user_id, tx_kind, posted_on);

create index finance_transactions_user_transfer_group_idx
  on public.finance_transactions (user_id, transfer_group_id)
  where transfer_group_id is not null;

alter table public.finance_transactions enable row level security;

create policy finance_transactions_select_own on public.finance_transactions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy finance_transactions_insert_own on public.finance_transactions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy finance_transactions_update_own on public.finance_transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No DELETE policy for authenticated clients.

-- Currency must match the posting account's native currency.
-- FOR SHARE on the account row serializes with finance_accounts currency UPDATEs
-- (same pairing as trading_pnl_enforce_account_currency).
create or replace function public.finance_transactions_enforce_account_currency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  acct_currency text;
  acct_user uuid;
begin
  select a.currency, a.user_id
    into acct_currency, acct_user
  from public.finance_accounts a
  where a.id = new.account_id
  for share;

  if acct_currency is null then
    raise exception 'finance account % not found', new.account_id;
  end if;

  if acct_user is distinct from new.user_id then
    raise exception 'finance transaction user_id must match account owner';
  end if;

  if new.currency is distinct from acct_currency then
    raise exception 'transaction currency % must equal account currency %',
      new.currency, acct_currency;
  end if;

  return new;
end;
$$;

create trigger finance_transactions_account_currency_trg
  before insert or update of account_id, currency, user_id
  on public.finance_transactions
  for each row
  execute function public.finance_transactions_enforce_account_currency();

-- Reject direct transfer inserts outside create_finance_transfer RPC.
create or replace function public.finance_transactions_require_transfer_rpc()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.tx_kind = 'transfer'
     and coalesce(nullif(current_setting('personal_os.finance_transfer_rpc', true), ''), '')
         is distinct from '1'
  then
    raise exception
      'transfer rows must be created via public.create_finance_transfer()';
  end if;
  return new;
end;
$$;

create trigger finance_transactions_transfer_rpc_trg
  before insert
  on public.finance_transactions
  for each row
  when (new.tx_kind = 'transfer')
  execute function public.finance_transactions_require_transfer_rpc();

-- Transfer economic fields are immutable after insert (notes may change).
create or replace function public.finance_transactions_lock_transfer_economics()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.tx_kind = 'transfer'
     or new.tx_kind = 'transfer'
  then
    if old.tx_kind is distinct from new.tx_kind
       or old.account_id is distinct from new.account_id
       or old.amount is distinct from new.amount
       or old.currency is distinct from new.currency
       or old.transfer_group_id is distinct from new.transfer_group_id
       or old.counterparty_account_id is distinct from new.counterparty_account_id
       or old.fx_rate is distinct from new.fx_rate
       or old.fx_rate_date is distinct from new.fx_rate_date
       or old.fx_source is distinct from new.fx_source
       or old.posted_on is distinct from new.posted_on
       or old.user_id is distinct from new.user_id
    then
      raise exception 'transfer economic fields are immutable; recreate via RPC';
    end if;
  end if;
  return new;
end;
$$;

create trigger finance_transactions_lock_transfer_economics_trg
  before update
  on public.finance_transactions
  for each row
  execute function public.finance_transactions_lock_transfer_economics();

-- Block changing account currency after any cash tx or linked trading PnL.
-- BEFORE UPDATE OF currency already holds the account row lock; child writers
-- that lock the account FOR SHARE (PnL path) serialize against this check.
create or replace function public.finance_accounts_lock_currency_after_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.currency is distinct from old.currency then
    if exists (
      select 1
      from public.finance_transactions t
      where t.user_id = old.user_id
        and t.account_id = old.id
    ) or exists (
      select 1
      from public.trading_pnl_entries p
      where p.user_id = old.user_id
        and p.account_id = old.id
    ) then
      raise exception
        'cannot change currency after transactions or linked trading PnL exist on account %',
        old.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger finance_accounts_lock_currency_trg
  before update of currency
  on public.finance_accounts
  for each row
  execute function public.finance_accounts_lock_currency_after_activity();

-- Deferred: every transfer_group_id must have exactly two economically paired
-- legs (or zero after a full pair delete / user CASCADE). Cardinality alone is
-- not enough — reciprocal counterparties, opposite signs, same posted_on, and
-- FX/amount rules are enforced here at commit. The RPC GUC only authorizes
-- insert of transfer rows; it is not the economic integrity guarantee.
-- Concurrent sessions can each insert a valid-looking 2-leg set on the same
-- (user_id, transfer_group_id) with four distinct accounts; under READ COMMITTED
-- both commit-time counts can see n=2 (write skew) without serialization.
-- One deterministic per-user pg_advisory_xact_lock serializes all transfer
-- group validators for that user (avoids per-group lock-order deadlocks when
-- a txn touches multiple groups).
create or replace function public.finance_transactions_transfer_group_complete_row()
returns trigger
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  gid uuid;
  uid uuid;
  n int;
  n_out int;
  n_in int;
  leg_out public.finance_transactions%rowtype;
  leg_in public.finance_transactions%rowtype;
  expected numeric;
begin
  if tg_op = 'DELETE' then
    gid := old.transfer_group_id;
    uid := old.user_id;
  else
    gid := new.transfer_group_id;
    uid := new.user_id;
  end if;

  if gid is null then
    return null;
  end if;

  -- Transaction-scoped; released at COMMIT/ROLLBACK. Namespace + user_id only
  -- (not transfer_group_id). search_path='' → always pg_catalog.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('personal_os.finance_transfer_validate'),
    pg_catalog.hashtext(uid::text)
  );

  select count(*) into n
  from public.finance_transactions t
  where t.user_id = uid
    and t.transfer_group_id = gid
    and t.tx_kind = 'transfer';

  -- n = 0: both legs gone (pair delete or auth.users CASCADE) — OK.
  if n = 0 then
    return null;
  end if;

  if n <> 2 then
    raise exception
      'transfer_group % for user % must have exactly 2 legs (found %)',
      gid, uid, n;
  end if;

  select count(*) filter (where t.amount < 0),
         count(*) filter (where t.amount > 0)
    into n_out, n_in
  from public.finance_transactions t
  where t.user_id = uid
    and t.transfer_group_id = gid
    and t.tx_kind = 'transfer';

  if n_out <> 1 or n_in <> 1 then
    raise exception
      'transfer_group % must have one outbound (−) and one inbound (+) leg',
      gid;
  end if;

  select * into leg_out
  from public.finance_transactions t
  where t.user_id = uid
    and t.transfer_group_id = gid
    and t.tx_kind = 'transfer'
    and t.amount < 0;

  select * into leg_in
  from public.finance_transactions t
  where t.user_id = uid
    and t.transfer_group_id = gid
    and t.tx_kind = 'transfer'
    and t.amount > 0;

  if leg_out.counterparty_account_id is distinct from leg_in.account_id
     or leg_in.counterparty_account_id is distinct from leg_out.account_id
  then
    raise exception
      'transfer_group % counterparties must be reciprocal', gid;
  end if;

  if leg_out.posted_on is distinct from leg_in.posted_on then
    raise exception
      'transfer_group % legs must share posted_on', gid;
  end if;

  if leg_out.currency = leg_in.currency then
    if leg_out.fx_rate is not null
       or leg_out.fx_rate_date is not null
       or leg_out.fx_source is not null
       or leg_in.fx_rate is not null
       or leg_in.fx_rate_date is not null
       or leg_in.fx_source is not null
    then
      raise exception
        'same-currency transfer_group % must not carry FX fields', gid;
    end if;
    if abs(leg_out.amount) is distinct from abs(leg_in.amount) then
      raise exception
        'same-currency transfer_group % amounts must match in absolute value',
        gid;
    end if;
  else
    if leg_out.fx_rate is null
       or leg_out.fx_rate_date is null
       or leg_out.fx_source is distinct from 'user_booked'
       or leg_in.fx_rate is distinct from leg_out.fx_rate
       or leg_in.fx_rate_date is distinct from leg_out.fx_rate_date
       or leg_in.fx_source is distinct from 'user_booked'
    then
      raise exception
        'cross-currency transfer_group % requires matching user_booked FX on both legs',
        gid;
    end if;
    -- Rate = destination units per one source unit; source = outbound magnitude.
    expected := round((-leg_out.amount) * leg_out.fx_rate, 8);
    if leg_in.amount is distinct from expected then
      raise exception
        'cross-currency transfer_group % inbound must equal round(source*rate,8) (expected %, got %)',
        gid, expected, leg_in.amount;
    end if;
  end if;

  return null;
end;
$$;

-- Split INSERT/UPDATE vs DELETE: PostgreSQL WHEN clauses must not reference TG_OP.
create constraint trigger finance_transactions_transfer_group_ins_upd_trg
  after insert or update of transfer_group_id, tx_kind, user_id
  on public.finance_transactions
  deferrable initially deferred
  for each row
  when (new.tx_kind = 'transfer')
  execute function public.finance_transactions_transfer_group_complete_row();

create constraint trigger finance_transactions_transfer_group_del_trg
  after delete
  on public.finance_transactions
  deferrable initially deferred
  for each row
  when (old.tx_kind = 'transfer')
  execute function public.finance_transactions_transfer_group_complete_row();

-- ---------------------------------------------------------------------------
-- Atomic transfer RPC (SECURITY INVOKER, auth.uid() only)
-- ---------------------------------------------------------------------------

create or replace function public.create_finance_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_source_amount numeric,
  p_posted_on date,
  p_fx_rate numeric default null,
  p_fx_rate_date date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_from public.finance_accounts%rowtype;
  v_to public.finance_accounts%rowtype;
  v_group uuid := gen_random_uuid();
  v_out_amount numeric;
  v_in_amount numeric;
  v_fx_rate numeric;
  v_fx_date date;
  v_fx_source text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_from_account_id is null or p_to_account_id is null then
    raise exception 'from and to accounts are required';
  end if;

  if p_from_account_id = p_to_account_id then
    raise exception 'from and to accounts must differ';
  end if;

  if p_posted_on is null then
    raise exception 'posted_on is required';
  end if;

  if p_source_amount is null
     or lower(btrim(p_source_amount::text)) in ('nan', 'infinity', '-infinity')
     or p_source_amount <= 0
  then
    raise exception 'source_amount must be a finite number > 0';
  end if;

  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'notes too long';
  end if;

  select * into v_from
  from public.finance_accounts a
  where a.id = p_from_account_id
    and a.user_id = v_uid
  for share;

  if not found then
    raise exception 'from account not found or not owned';
  end if;

  if not v_from.is_active then
    raise exception 'from account is inactive';
  end if;

  select * into v_to
  from public.finance_accounts a
  where a.id = p_to_account_id
    and a.user_id = v_uid
  for share;

  if not found then
    raise exception 'to account not found or not owned';
  end if;

  if not v_to.is_active then
    raise exception 'to account is inactive';
  end if;

  v_out_amount := -p_source_amount;

  if v_from.currency = v_to.currency then
    if p_fx_rate is not null or p_fx_rate_date is not null then
      raise exception 'same-currency transfer must not include FX fields';
    end if;
    v_in_amount := p_source_amount;
    v_fx_rate := null;
    v_fx_date := null;
    v_fx_source := null;
  else
    if p_fx_rate is null or p_fx_rate_date is null then
      raise exception
        'cross-currency transfer requires user-booked fx_rate and fx_rate_date';
    end if;
    if lower(btrim(p_fx_rate::text)) in ('nan', 'infinity', '-infinity')
       or p_fx_rate <= 0
    then
      raise exception 'fx_rate must be a finite number > 0';
    end if;
    -- Rate = destination units per one source unit.
    v_in_amount := round(p_source_amount * p_fx_rate, 8);
    if v_in_amount <= 0 then
      raise exception 'computed destination amount must be > 0';
    end if;
    v_fx_rate := p_fx_rate;
    v_fx_date := p_fx_rate_date;
    v_fx_source := 'user_booked';
  end if;

  -- Allow the transfer-row trigger for this transaction only.
  perform set_config('personal_os.finance_transfer_rpc', '1', true);

  insert into public.finance_transactions (
    user_id,
    account_id,
    posted_on,
    amount,
    currency,
    tx_kind,
    transfer_group_id,
    counterparty_account_id,
    fx_rate,
    fx_rate_date,
    fx_source,
    notes
  ) values (
    v_uid,
    v_from.id,
    p_posted_on,
    v_out_amount,
    v_from.currency,
    'transfer',
    v_group,
    v_to.id,
    v_fx_rate,
    v_fx_date,
    v_fx_source,
    p_notes
  );

  insert into public.finance_transactions (
    user_id,
    account_id,
    posted_on,
    amount,
    currency,
    tx_kind,
    transfer_group_id,
    counterparty_account_id,
    fx_rate,
    fx_rate_date,
    fx_source,
    notes
  ) values (
    v_uid,
    v_to.id,
    p_posted_on,
    v_in_amount,
    v_to.currency,
    'transfer',
    v_group,
    v_from.id,
    v_fx_rate,
    v_fx_date,
    v_fx_source,
    p_notes
  );

  return v_group;
end;
$$;

revoke all on function public.create_finance_transfer(
  uuid, uuid, numeric, date, numeric, date, text
) from public, anon, authenticated, service_role;

grant execute on function public.create_finance_transfer(
  uuid, uuid, numeric, date, numeric, date, text
) to authenticated;

revoke all on function public.finance_transactions_enforce_account_currency()
  from public, anon, authenticated, service_role;
revoke all on function public.finance_transactions_require_transfer_rpc()
  from public, anon, authenticated, service_role;
revoke all on function public.finance_transactions_lock_transfer_economics()
  from public, anon, authenticated, service_role;
revoke all on function public.finance_accounts_lock_currency_after_activity()
  from public, anon, authenticated, service_role;
revoke all on function public.finance_transactions_transfer_group_complete_row()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- trading_pnl_entries (orthogonal performance ledger — not cash)
-- ---------------------------------------------------------------------------

create table public.trading_pnl_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid,
  traded_on date not null,
  realized_pnl numeric not null default 0,
  unrealized_pnl numeric not null default 0,
  currency text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  constraint trading_pnl_currency_iso check (currency ~ '^[A-Z]{3}$'),
  constraint trading_pnl_realized_finite check (
    lower(btrim(realized_pnl::text)) not in ('nan', 'infinity', '-infinity')
  ),
  constraint trading_pnl_unrealized_finite check (
    lower(btrim(unrealized_pnl::text)) not in ('nan', 'infinity', '-infinity')
  ),
  constraint trading_pnl_notes_length check (
    notes is null or char_length(notes) <= 2000
  ),
  constraint trading_pnl_account_fkey
    foreign key (user_id, account_id)
    references public.finance_accounts (user_id, id)
    on delete no action
    deferrable initially deferred
);

create index trading_pnl_entries_user_traded_idx
  on public.trading_pnl_entries (user_id, traded_on);

alter table public.trading_pnl_entries enable row level security;

create policy trading_pnl_entries_select_own on public.trading_pnl_entries
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy trading_pnl_entries_insert_own on public.trading_pnl_entries
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy trading_pnl_entries_update_own on public.trading_pnl_entries
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No DELETE policy for authenticated clients.

-- When account_id is set, PnL currency must match the linked account.
-- No unique (account_id, traded_on) — multiple daily snapshots allowed.
create or replace function public.trading_pnl_enforce_account_currency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  acct_currency text;
  acct_user uuid;
begin
  if new.account_id is null then
    return new;
  end if;

  -- FOR SHARE: serialize with finance_accounts currency UPDATEs (row locked there).
  select a.currency, a.user_id
    into acct_currency, acct_user
  from public.finance_accounts a
  where a.id = new.account_id
  for share;

  if acct_currency is null then
    raise exception 'finance account % not found for trading PnL', new.account_id;
  end if;

  if acct_user is distinct from new.user_id then
    raise exception 'trading PnL user_id must match linked account owner';
  end if;

  if new.currency is distinct from acct_currency then
    raise exception
      'trading PnL currency % must equal linked account currency %',
      new.currency, acct_currency;
  end if;

  return new;
end;
$$;

create trigger trading_pnl_account_currency_trg
  before insert or update of account_id, currency, user_id
  on public.trading_pnl_entries
  for each row
  execute function public.trading_pnl_enforce_account_currency();

revoke all on function public.trading_pnl_enforce_account_currency()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Explicit table privileges
-- ---------------------------------------------------------------------------

revoke all on table public.finance_accounts from anon, authenticated;
revoke all on table public.finance_transactions from anon, authenticated;
revoke all on table public.trading_pnl_entries from anon, authenticated;

grant select, insert, update on table public.finance_accounts to authenticated;
grant select, insert, update on table public.finance_transactions to authenticated;
grant select, insert, update on table public.trading_pnl_entries to authenticated;

-- ---------------------------------------------------------------------------
-- Privilege assertions (fail migration if grants are wrong)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
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
      raise exception
        'authenticated must not have DELETE/TRUNCATE/REFERENCES/TRIGGER on %', t;
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
    raise exception
      'create_finance_transfer EXECUTE must be granted to authenticated and denied to anon';
  end if;
end $$;
