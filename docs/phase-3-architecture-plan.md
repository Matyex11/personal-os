# Phase 3 — Finance architecture and implementation plan

**Status:** **Approved decisions locked** (2026-11-25, Europe/Bucharest) — planning doc only
**Branch / base HEAD:** `cursor/personal-os-foundation-67da` @ `8e55b047c8d43e70f9f5d44360f87b4f9001aafc`
**Mode:** Documentation — **no** app feature implementation, migration apply, hosted DB, Docker, PROD, deploy, service-role, or `.env.local` access in this pass.

**Sources:** `docs/ROADMAP.md`, `docs/PRODUCT_SPEC.md`, `docs/DATABASE_SCHEMA.md`, `docs/DECISIONS.md` (esp. D009, D020, D022, R004), `docs/SECURITY.md`, `docs/MCP_SPEC.md`, Phase 1B/2 patterns (gating, no DELETE, ownership).

---

## Approved decisions (locked)

| # | Topic | Decision |
|---|--------|----------|
| 1 | **R004 FX** | **User-booked FX** for cross-currency transfers. **No** automatic FX provider. |
| 2 | **Opening balance** | Dedicated `opening_balance` kind; **in** account balance; **excluded** from personal cashflow and profit; **one per account**. |
| 3 | **Signed amounts** | Inbound **+**, outbound **−**. |
| 4 | **Trading PnL** | `traded_on` daily; **realized** period-additive; **unrealized** point-in-time snapshot. |
| 5 | **Expense category** | Optional free text. |
| 6 | **Business revenue/costs** | Cash-posted only. |
| 7 | **Fees** | In personal cashflow; **shown separately**. |
| 8 | **Cross-currency rate** | Destination units per **one** source unit. |
| 9 | **Transfer creation** | **Atomic**: both legs in one DB transaction via RPC (or equivalent); no partials. |
| 10 | **Reports / FX** | No provider FX; reports without an explicit rate stay **separated by currency**. |

**Balance clarity:** account balances = `opening_balance` + all cash-posting kinds; **never** trading PnL.

Still required later: **L3** to apply the finance migration on `personal-os-dev` after P3-M0 draft.

---

## 0. Goals and non-goals

### In scope (ROADMAP Phase 3)

- `finance_accounts` + typed `finance_transactions` + separate `trading_pnl_entries`
- Soft module gating (`finances`) consistent with Phase 2
- Honest balance / cashflow / business profit / trading PnL semantics
- Multi-currency **account-native** amounts; RON profile base; **no silent** mixed-currency sums
- Sensitive-by-default; ownership + RLS; no default AI/MCP finance tools
- **Export draft** (JSON + CSV) for finance ledgers — not the full Phase 5 OS portability suite

### Explicit non-goals (this phase)

- MCP finance tools / AI unlock (Phase 4+)
- Full multi-module export/import (Phase 5)
- Broker/bank APIs, OFX/CSV bank sync, XNINE trading execution
- Automatic / provider FX feeds
- Soft-deleting via SQL DELETE for authenticated clients (prefer deactivate/archive)
- Charts unless a later decision revisits R006
- App feature implementation in this planning commit

---

## 1. Proposed data model and relationships

### 1.1 Entity overview

```
profiles.base_currency (default RON)
auth.users
  └── finance_accounts
        ├── finance_transactions   (cash & recognition ledger)
        └── trading_pnl_entries    (performance only; optional account link)
```

Composite ownership: every finance row has `user_id`; children reference parents with
`(user_id, parent_id)` → parent `(user_id, id)` (D024 / DATABASE_SCHEMA).

### 1.2 `finance_accounts`

| Column | Type / rule | Notes |
|--------|-------------|--------|
| `id` | uuid PK | Also `UNIQUE (user_id, id)` for composite FKs |
| `user_id` | uuid → `auth.users` CASCADE | Session-bound |
| `name` | text, non-empty | |
| `currency` | char(3) ISO 4217 | **Native currency**; immutable after first posted tx (recommended) |
| `account_kind` | enum | `cash` \| `bank` \| `brokerage` \| `wallet` \| `other` |
| `is_sensitive` | boolean **default true** | App/MCP gate even when RLS allows owner read |
| `is_active` | boolean **default true** | Soft retire; no client DELETE |
| `notes` | text nullable | Sensitive |
| `created_at` / `updated_at` | timestamptz | |

**Balance** is not stored as a mutable column. It is **derived** (see §3). Optional
cached balance is out of scope for v1.

**Opening balance:** dedicated `tx_kind = 'opening_balance'` — see §1.3 / §3. At most
**one** opening-balance row per account (partial unique).

### 1.3 `finance_transactions`

One row = one typed event on exactly one account. Transfers are **two legs**
sharing `transfer_group_id`, created **atomically** (§2.3).

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `account_id` | Composite FK → `finance_accounts` |
| `posted_on` | Civil date (profile TZ for “today”; historical editable) |
| `amount` | `numeric`, finite; signed inbound + / outbound − (§3.1) |
| `currency` | Equals account native currency for the posting account |
| `tx_kind` | See table below |
| `income_category` | Only if `tx_kind = 'income'`: `employment` \| `freelance` \| `business` \| `other` |
| `expense_category` | Optional **free text**; only meaningful for `expense` |
| `transfer_group_id` | uuid; required for `transfer`; links both legs |
| `counterparty_account_id` | Other own account; required for `transfer` |
| `fx_rate` | Required on cross-currency transfer legs; **destination units per 1 source unit**; `fx_source = 'user_booked'` |
| `fx_rate_date` | Required with `fx_rate` |
| `fx_source` | `'user_booked'` for Phase 3 cross-currency transfers; no provider values |
| `notes` | Sensitive |
| `created_at` / `updated_at` | |

Prefer a **single signed `amount`** per row (do not ship parallel `revenue_amount` /
`cost_amount` unless a later decision revisits DATABASE_SCHEMA wording).

#### `tx_kind` vocabulary (locked)

| Kind | Sign | In account balance? | Personal cashflow? | Business profit? |
|------|------|---------------------|--------------------|------------------|
| `opening_balance` | + or − (starting position) | **Yes** | **No** | **No** |
| `deposit` | + | Yes | Yes | No |
| `withdrawal` | − | Yes | Yes | No |
| `transfer` | − out / + in | Yes | No (show as moves, not cashflow total) | No |
| `income` | + | Yes | Yes | No |
| `expense` | − | Yes | Yes | No |
| `business_revenue` | + | Yes | No | **Yes** (revenue) |
| `business_cost` | − | Yes | No | **Yes** (cost) |
| `fee` | − | Yes | **Yes, shown separately** | No |
| `other` | + or − | Yes | Optional / labeled; **excluded from profit** | **No** |

### 1.4 `trading_pnl_entries` (orthogonal)

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `account_id` | Optional FK → brokerage `finance_accounts` |
| `traded_on` | **Daily** civil date (required) |
| `realized_pnl` | numeric; **period-additive** (sum over `traded_on` in range) |
| `unrealized_pnl` | numeric; **point-in-time snapshot** for that `traded_on` (do not sum snapshots across days as if additive without explicit product rules — report “as of date”) |
| `currency` | ISO; no silent RON rollup |
| `notes` | Sensitive |
| `created_at` / `updated_at` | |

**Invariant:** PnL rows **never** change cash balances. Brokerage cash in/out uses
`deposit` / `withdrawal` / `transfer` / `opening_balance` on `finance_transactions` only.

### 1.5 Module gating

Reuse Phase 2 pattern: module key `finances` already in `MODULE_KEYS`.

- Nav `/finances` when active
- Dashboard section (per-currency cash buckets + “open finances”)
- Soft `DisabledModuleState` when inactive; preserve-on-failure

---

## 2. DB constraints, indexes, ownership, RLS

### 2.1 Ownership & FKs

- `UNIQUE (user_id, id)` on `finance_accounts`
- `finance_transactions (user_id, account_id)` → `finance_accounts (user_id, id)`
- `finance_transactions (user_id, counterparty_account_id)` → same (nullable except transfers)
- `trading_pnl_entries (user_id, account_id)` → accounts (nullable)
- `ON DELETE`: prefer **NO ACTION** / restrict account delete while txs exist; account retire via `is_active = false`. Whole-user purge via `auth.users` CASCADE (Phase 1B pattern).

### 2.2 CHECKs (fail closed)

1. `amount` / PnL numerics: reject NaN / ±Infinity (Phase 2 physical pattern).
2. `currency` ~ `^[A-Z]{3}$`.
3. `tx_kind`-gated companions:
   - `income_category` NOT NULL iff `tx_kind = 'income'`; NULL otherwise
   - `transfer_group_id` and `counterparty_account_id` NOT NULL iff `tx_kind = 'transfer'`
   - `counterparty_account_id IS DISTINCT FROM account_id`
4. Sign-by-kind (inbound kinds `amount > 0`; outbound kinds `amount < 0`; `opening_balance` / `other` allow either non-zero).
5. Cross-currency transfer: when the two accounts differ in currency, both legs must carry matching `fx_rate` / `fx_rate_date` / `fx_source = 'user_booked'`, and amounts must satisfy destination = source × rate (within numeric tolerance defined in migration).
6. Same-currency transfer: equal absolute amounts, opposite signs; FX fields NULL.
7. **One** `opening_balance` per `(user_id, account_id)` (partial unique).
8. Calendar dates for `posted_on` / `traded_on`.

### 2.3 Transfer integrity (atomic)

- Transfer create/update path uses a **single DB transaction** (Postgres RPC / `SECURITY INVOKER` function preferred) that inserts **both** legs or neither.
- Same `transfer_group_id`; exactly two legs per group per user.
- App/server must not perform two independent inserts that can leave a partial transfer.
- At most two legs per `transfer_group_id` (unique/trigger as specified in M0).

### 2.4 Indexes

| Index | Purpose |
|-------|---------|
| `finance_accounts (user_id, is_active)` | List |
| `finance_transactions (user_id, account_id, posted_on)` | Account ledger |
| `finance_transactions (user_id, posted_on)` | Period reports |
| `finance_transactions (user_id, tx_kind, posted_on)` | Classifiers |
| `finance_transactions (user_id, transfer_group_id)` | Pair lookup |
| Partial unique opening balance | One per account |
| `trading_pnl_entries (user_id, traded_on)` | Daily PnL |

### 2.5 RLS & privileges (align SECURITY.md)

- RLS on; `auth.uid() = user_id` for SELECT/INSERT/UPDATE
- **No DELETE** policy/grant for authenticated
- `REVOKE ALL` from `anon`/`authenticated`, then grant SELECT/INSERT/UPDATE only
- Transfer RPC: execute for `authenticated` only; binds `user_id` from `auth.uid()`
- Sensitive: RLS necessary but not sufficient — no default AI/MCP finance reads (Phase 4)

**Do not claim live RLS from Vitest mocks.** Ship `supabase/tests/` SQL assertions after L3 apply.

---

## 3. Semantics: balance, cashflow, business profit, trading PnL

### 3.1 Amount sign convention (**approved**)

**Inbound +, outbound −** on the posting account:

| Kind | `amount` |
|------|----------|
| `deposit`, `income`, `business_revenue` | `> 0` |
| `withdrawal`, `expense`, `business_cost`, `fee` | `< 0` |
| `transfer` | Outgoing `< 0`, incoming `> 0` |
| `opening_balance`, `other` | Non-zero; sign reflects starting / ad-hoc direction |

### 3.2 Account cash balance (**approved clarity**)

For account `A` in native currency `C`:

```
balance(A) = SUM(amount)
  WHERE account_id = A
    AND currency = C
    AND tx_kind IN (
      'opening_balance', 'deposit', 'withdrawal', 'transfer',
      'income', 'expense', 'business_revenue', 'business_cost',
      'fee', 'other'
    )
```

- **Includes** `opening_balance` and all cash-posting kinds above.
- **Never includes** `trading_pnl_entries`.
- Never convert inside `balance(A)`.

### 3.3 Personal cashflow (not “profit”)

For a period, per currency bucket:

- **Include:** `deposit`, `withdrawal`, `income`, `expense`, **`fee` (shown as its own line/series)**
- **Exclude:** `opening_balance`, `transfer` (list as moves), `business_revenue`, `business_cost`, `other` (from profit; cashflow may list `other` only if explicitly labeled — default exclude from cashflow totals), trading PnL
- **Label UI:** “Personal cashflow” — never “Profit”
- `income_category = business` ≠ `business_revenue`

### 3.4 Business profit

Cash-posted only:

```
business_profit = SUM(amount) FILTER (
  WHERE tx_kind IN ('business_revenue', 'business_cost')
)
```

**Only** those two kinds. Never `opening_balance`, income/expense, deposits, fees, transfers, other, or PnL.

### 3.5 Trading PnL

- **Realized:** sum `realized_pnl` over `traded_on` in the selected period (period-additive).
- **Unrealized:** value **as of** a chosen `traded_on` (latest snapshot on/before that date) — point-in-time; do not naively sum daily unrealized figures as period P&L.
- Never add into cash balance or business profit.
- UI: “Trading performance” — not “cash”.

### 3.6 Forbidden derivations

| Bad formula | Why |
|-------------|-----|
| `SUM(all amounts)` as “profit” | Mixes cash moves and recognition |
| `income − expense` as business profit | Wrong ledger |
| Brokerage deposit as trading gain | Cash ≠ PnL |
| Transfer as expense/income | Zero net worth move |
| Opening balance in cashflow/profit | Starting position only |
| Unrealized sum across days as “period unrealized” | Snapshots are not additive |

---

## 4. Multi-currency and R004 (**approved: user-booked**)

### 4.1 Locked rules

1. Every account has one native ISO currency.
2. Profile `base_currency` default **RON** (D020); optional reporting only.
3. Native ledgers and balances never silently mix currencies.
4. Cross-currency transfers require user-booked `fx_rate`, `fx_rate_date`, `fx_source = 'user_booked'`.
5. Rate meaning: **destination units per one source unit** (source = outgoing account currency; destination = incoming).
6. **No** automatic FX provider in Phase 3 (or later without a new decision).
7. Reports **without** an explicit user-supplied rate stay **separated by currency** — never invent a mid-market total.
8. Optional RON estimate views only when the user supplies rate + date + source for that report.

### 4.2 Cross-currency transfer example

EUR account → RON account, rate `5.00` means 1 EUR = 5 RON:

- Outgoing leg: `amount = -100` (EUR)
- Incoming leg: `amount = +500` (RON)
- Both legs: `fx_rate = 5`, `fx_rate_date = …`, `fx_source = 'user_booked'`

Same-currency: FX fields NULL; absolute amounts equal.

---

## 5. Privacy and exports

### 5.1 Sensitivity

- Accounts default `is_sensitive = true`.
- Phase 3: owner session only. Phase 4+: MCP finance tools deny by default.

### 5.2 Export draft (Phase 3; D022)

| Artifact | Contents |
|----------|----------|
| **JSON** | Separate arrays: `accounts`, `transactions`, `trading_pnl_entries`; preserve ids, currencies, `tx_kind`, dates, `transfer_group_id`, FX fields, categories |
| **CSV** | Separate files per ledger — not one collapsed soup |

Preserve currency, type, dates, relationships. Do not convert amounts in export unless parallel base columns include explicit FX metadata. Full OS export/import remains Phase 5.

---

## 6. Practical milestone sequence

*(Unchanged sequence; criteria updated for approved decisions.)*

| ID | Milestone | Completion criteria |
|----|-----------|---------------------|
| **P3-M0** | Schema draft + SQL tests (git only) | Migration SQL for accounts / txs / pnl + `opening_balance` unique + transfer RPC + CHECKs/RLS/grants + `supabase/tests`; **stop for L3** before apply |
| **P3-M1** | Accounts + gating | `/finances` soft-gated; create/list/deactivate accounts; native currency + kind; dashboard stub; Vitest + Playwright inactive/active |
| **P3-M2** | Core cash txs | opening_balance (once) + deposit/withdrawal/income/expense/fee/other; signed amounts; balances include opening; cashflow excludes opening; e2e happy path |
| **P3-M3** | Transfers | Atomic RPC both legs; same-currency + user-booked cross-currency (dest per 1 source); no partials |
| **P3-M4** | Business ledger + profit view | cash-posted business_revenue/cost; profit = those only; cashflow ≠ profit; fees separate in cashflow |
| **P3-M5** | Trading PnL | traded_on daily; realized additive; unrealized as-of snapshot; UI separated from cash |
| **P3-M6** | RON view + export draft | Per-currency buckets; optional RON only with explicit rate; JSON+CSV finance export |
| **P3-M7** | Hardening / acceptance | Docs reconcile; regression e2e; no semantic leaks; acceptance note |

**Human gates:** after M0 (L3 apply), after M7 (phase accept). FX policy is already locked (user-booked).

---

## 7. Essential testing requirements

### 7.1 Vitest (domain)

- Sign/kind matrix; balance includes `opening_balance`, excludes PnL
- Cashflow excludes opening; fees included and separable; profit = business kinds only
- Same-currency transfer nets zero; cross-currency uses booked rate (dest per 1 source)
- Unrealized as-of vs realized sum semantics
- No silent multi-currency aggregation
- Ownership / transfer atomicity helpers

### 7.2 Playwright (authenticated)

- Module inactive → disabled state
- Account → opening balance once → deposit → balance
- Transfer (same + cross-currency booked) → both ledgers; no partial on failure
- Business revenue/cost → profit widget; fees in cashflow separately
- PnL entry does not change cash balance
- Export smoke if M6 ships

### 7.3 SQL (DEV after L3)

- RLS own-only; no DELETE; opening unique; transfer RPC atomicity; FX CHECKs; composite FK denial

### 7.4 Explicit non-claims

Mocks ≠ live RLS. No provider-FX tests (none in scope).

---

## 8. Conflicts with existing architecture / docs

| Item | Tension | Locked stance |
|------|---------|---------------|
| DATABASE_SCHEMA lacked `opening_balance` | Conceptual draft | Add `opening_balance` kind in Phase 3 migration; update schema docs in M0/M7 |
| DATABASE_SCHEMA `revenue_amount` / `cost_amount` | Parallel to `amount` | **Single `amount`** |
| ROADMAP Phase 3 export vs Phase 5 | Scope | Phase 3 = **finance-only** draft |
| D003 Recharts | Stack naming | Tables/text first; R006 deferred |
| `income_category = business` vs `business_revenue` | Confusion | Keep both; UI must distinguish |
| R004 previously unresolved | Risk table | **Resolved for Phase 3:** user-booked only; no provider |
| No finance tables applied yet | Only module key | M0 net-new; L3 to apply |

### Remaining non-product gate

- **L3** authorization to apply the finance migration on `personal-os-dev` after P3-M0.

---

## 9. Stop

Approved architecture plan for Phase 3 finances.
**No app features, migration apply, or infra actions in this documentation update.**

Implementation proceeds only after explicit milestone authorization (starting with P3-M0 schema draft, then L3 apply).
