# Personal OS — Database Schema (Conceptual)

> **Status:** Phase 1B migration
> `supabase/migrations/20261122190000_phase1b_core.sql` for **personal-os-dev**
> (`qyysmgwdvhftbgwhpbjt`, `eu-central-1`) — **applied on DEV** (human L3).
> Docker stays stopped. Never run against an unknown/production project by default.
> Further schema changes still require explicit L3.

## Design goals

1. Every user-owned row includes `user_id` (FK → `auth.users`) and is protected by RLS.
2. FKs that reference user-owned parents should be **composite** `(user_id, parent_id)` where practical, to prevent cross-user references.
3. Chapters scope “what is active now” without deleting history; lifecycle is explicit.
4. Projects, milestones, and tasks are **separate concepts** with optional same-user links.
5. Habit logs: original `missed` rows are **immutable history**; recovery is a **linked event**, never a rewrite.
6. Finance semantics stay strict: cash ≠ income/expense semantics ≠ business P&L ≠ trading PnL.
7. Behavioural + detailed financial data are **sensitive** — not default AI/MCP readable.
8. Audit log is append-oriented for important mutations.

## Ownership & composite FK pattern

- Every domain table carries `user_id`.
- When child → parent (e.g. `habit_logs` → `habits`, `tasks` → `projects`):
  - Prefer UNIQUE `(user_id, id)` on the parent (in addition to PK on `id`), and
  - FK `(user_id, parent_id)` → parent `(user_id, id)`.
- Same pattern for: `habit_logs.habit_id`, `milestones.project_id`,
  `tasks.project_id`, `tasks.milestone_id`, `habit_logs.is_recovery_for` →
  `habit_logs`, `finance_transactions.account_id`, chapter-scoped children →
  `chapters`, `module_activations.chapter_id`.
- Application code must still set `user_id` from the authenticated session — never
  from client-supplied “act as” fields.

## Core entities

### `profiles`

Extends auth user with app preferences.

| Column | Notes |
|--------|-------|
| `id` PK | Same as `auth.users.id` |
| `display_name` | |
| `timezone` | Default **`Europe/Bucharest`** (D019) |
| `base_currency` | Default **`RON`**; multi-currency still supported on accounts (D020) |
| `created_at` / `updated_at` | |

v0 is **single-user product** with **user-scoped** rows (D013). Schema stays
multi-user-safe via `user_id` + RLS.

### `chapters`

Named life periods / history frames.

| Column | Notes |
|--------|-------|
| `id` PK | UUID |
| `user_id` | Owner |
| `title`, `summary` | |
| `started_on`, `ended_on` | `ended_on` null only while status is open/current |
| `status` | `planned` \| `active` \| `closed` |
| `is_current` | Denormalized flag; must agree with lifecycle rules below |

#### Chapter lifecycle constraints

1. At most **one** chapter with `is_current = true` per `user_id` (partial unique index).
2. The current chapter must have `status = 'active'` and `ended_on IS NULL`.
3. `planned`: `ended_on` must be NULL; `is_current` must be false.
4. `active`: `ended_on` must be NULL.
5. `closed`: `ended_on` **required**; `is_current` must be false.
6. Closing a chapter: set `status = 'closed'`, set `ended_on`, clear `is_current`;
   optionally activate another chapter in the same transaction.
7. `started_on <= ended_on` when `ended_on` is present.
8. Chapters are not hard-deleted in normal flows (prefer close). Authenticated
   clients have **no DELETE** grant/policy; destructive delete is L3 + confirmation.
9. Historical rows that reference a closed chapter remain valid. If a chapter row
   is removed via a privileged path, optional child links use
   `ON DELETE SET NULL (chapter_id)` so `user_id` stays intact.

**Relationships:** Optional/required parent for chapter-scoped activations and
domain rows; see module activation rules below.

### `module_activations`

Which product modules are live for a user — **global defaults** and/or
**chapter overrides**.

| Column | Notes |
|--------|-------|
| `id` PK | |
| `user_id` | |
| `scope` | `global` \| `chapter` (explicit; do not overload nulls) |
| `chapter_id` | Required when `scope = 'chapter'`; **NULL** when `scope = 'global'` |
| `module_key` | `habits`, `tasks`, `projects`, `milestones`, `checkins`, `finances`, `physical`, `behavioural`, `reviews`, `xnine_tracking` |
| `is_active` | |
| `settings` | JSONB module-specific flags |

#### Global vs chapter-scoped activation

- **Global** rows (`scope = 'global'`, `chapter_id IS NULL`): default on/off for
  the user when no chapter override exists.
- **Chapter** rows (`scope = 'chapter'`, `chapter_id` set): override for that
  chapter only. Resolution: chapter override if present, else global, else
  inactive.
- Prefer activating modules for the **current chapter** in product UX; globals
  are fallbacks / templates.

#### Uniqueness (nullable-safe)

PostgreSQL UNIQUE treats NULLs as distinct, so
`UNIQUE (user_id, chapter_id, module_key)` is **incorrect** for global rows.

Use:

- `UNIQUE (user_id, module_key) WHERE scope = 'global'`
- `UNIQUE (user_id, chapter_id, module_key) WHERE scope = 'chapter'`
- CHECK: `(scope = 'global' AND chapter_id IS NULL) OR (scope = 'chapter' AND chapter_id IS NOT NULL)`
- Composite FK when chapter-scoped: `(user_id, chapter_id)` → `chapters (user_id, id)`
  with `ON DELETE CASCADE` (activation rows are disposable config, not history).

### `habits`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `chapter_id?` | Composite ownership to chapter when set |
| `name`, `description` | |
| `cadence` | JSON v1: `daily` \| `weekdays` + `startOn` / optional `endOn` |
| `min_value` | Minimum acceptable quantity (numeric or boolean-as-0/1) |
| `target_value` | Aspirational target (≥ min) |
| `unit` | Optional (`minutes`, `reps`, …) |
| `is_active` | Deactivate instead of hard-delete |

Optional chapter link: `(user_id, chapter_id)` → `chapters (user_id, id)`
`ON DELETE SET NULL (chapter_id)` (PG17 column list — never nullifies `user_id`).

**Cadence integrity (Phase 1B):**
- App: `createHabitSchema` embeds `habitCadenceSchema`; `createHabit()` is the
  server-only write boundary (rejects bad kinds, empty weekdays, invalid ISO
  weekdays 1–7, invalid `endOn < startOn`, negative mins).
- DB: fail-closed `public.is_valid_habit_cadence(jsonb)` (IMMUTABLE, SECURITY
  INVOKER; always TRUE/FALSE; authenticated EXECUTE for CHECK) with
  `CHECK (… IS TRUE)` + `min_value >= 0`. If `weekdays` is present for any
  kind, it must be a 1–7 length array of integers 1..7 (Zod parity).

### `habit_logs`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `habit_id` | Composite FK to habit |
| `logged_on` | Date in user TZ intent |
| `status` | `completed` \| `partial` \| `missed` \| `not_scheduled` \| `recovery` |
| `value` | Actual amount; null when not applicable; CHECK `value IS NULL OR value >= 0` |
| `notes` | |
| `recovers_log_id` | FK → original log when `status = 'recovery'`; **required** for recovery |
| `created_at` | |

#### Recovery model (immutable history)

1. A scheduled miss/partial is stored and **remains forever** as that status
   (no UPDATE of that row’s status to completed/partial/recovery).
2. Recovery is a **separate** `habit_logs` row with `status = 'recovery'` and
   `recovers_log_id` pointing at the original **missed or partial** log.
3. Domain/server requirements (also enforced in app code before insert):
   - Original log must belong to the **same user** as the recovery.
   - Original log must belong to the **same habit**.
   - Original `status` must be `missed` or `partial` (not completed /
     not_scheduled / recovery).
   - Original log row must **remain unchanged** (append-only recovery).
4. Database constraints to enforce (Phase 1B migrations):
   - CHECK: `(status = 'recovery') = (recovers_log_id IS NOT NULL)`.
   - UNIQUE `(user_id, id)` on `habit_logs` and composite FK
     `(user_id, recovers_log_id) → habit_logs (user_id, id)` so recovery cannot
     point at another user’s log.
   - Prefer also carrying `habit_id` on the FK path: composite
     `(user_id, habit_id, recovers_log_id)` → parent unique
     `(user_id, habit_id, id)` **or** a trigger/RPC that rejects cross-habit
     links (CHECK alone cannot compare to another row without a trigger).
   - Trigger (recommended): `BEFORE UPDATE` on `habit_logs` that rejects
     changes to `status` / `logged_on` / `habit_id` / `user_id` for rows that
     are referenced by any `recovers_log_id`, and rejects updating a primary
     log’s `status` away from `missed`/`partial` when a recovery already
     exists; optionally reject any `status` rewrite from `missed`/`partial`
     to `completed` entirely.
   - Trigger or SECURITY DEFINER insert function: verify referenced row’s
     `status IN ('missed','partial')` and `habit_id` matches.
5. Do not delete the original log when recovering. Clients have **no DELETE**
   privilege on `habit_logs` / `habits`. FKs `habit_logs` → `habits` and
   recovery → original use named constraints `habit_logs_habit_fkey` /
   `habit_logs_recovery_fkey` (`ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`):
   individual habit/original deletes still fail while dependents exist; whole
   `auth.users` CASCADE purge can complete in one transaction without casually
   CASCADE-wiping history on single-habit delete.
6. Unique: one primary log per `(habit_id, logged_on)` where
   `status <> 'recovery'`; recoveries are additional rows (unique on
   `(habit_id, recovers_log_id)` for recovery rows).

#### Status → reporting effects (R005 resolved)

Denominator = **expected scheduled occurrences** for the window (from cadence),
not merely rows that happen to exist in `habit_logs`.

Two metrics (no numeric “partial credit”):

- **Target attainment** = `completed / scheduledOccurrences`
- **Minimum adherence** = `(completed + partial) / scheduledOccurrences`

| Outcome | In denominator? | Target numerator | Minimum numerator | Notes |
|---------|-----------------|------------------|-------------------|-------|
| `completed` | Yes | Yes | Yes | Met **target** |
| `partial` | Yes | No | Yes | Met **min**, below target |
| `missed` | Yes | No | No | Permanent historical fact |
| **unlogged** | Yes | No | No | Scheduled occurrence with **no** primary log — must be exposed, never silently omitted |
| `not_scheduled` | No | — | — | Off-cadence |
| `recovery` | No | — | — | Linked event only; **never** alters historical adherence |

Reporting is read-only: no automatic historical backfill and no mutation of old
records. Historical charts plot original primary statuses; recovery is a
separate annotation series.

### `projects`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `chapter_id?` | Optional chapter: `ON DELETE SET NULL (chapter_id)` |
| `title`, `description` | |
| `status` | `active`, `paused`, `done`, `dropped` (prefer status over delete) |
| `priority` | Optional ordinal |
| `target_date` | Optional |

### `milestones`

**Not** a project subtype and **not** a task.

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `project_id` | Optional; composite FK; `ON DELETE SET NULL (project_id)` |
| `title`, `description` | |
| `status` | `pending`, `hit`, `missed`, `cancelled` |
| `target_on`, `achieved_on` | |

### `tasks`

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `project_id?`, `milestone_id?` | Optional same-user links; `ON DELETE SET NULL (col)` each |
| `title`, `notes` | |
| `status` | `todo`, `doing`, `done`, `cancelled` |
| `due_on`, `completed_at` | |

### `check_ins`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `chapter_id?` | |
| `checked_on` | |
| `mood` | Integer 1–5 (v1 simple) |
| `energy` | Integer 1–5 (v1 simple) |
| `focus` | Integer 1–5 (v1 simple) |
| `body` | Optional short note (elevated sensitivity) |
| `prompt_set_key` | Default `v1_simple` |

### Finances

> **Phase 3 P3-M0 draft:** migration
> `supabase/migrations/20261125140000_phase3_finance.sql` — **not applied** until L3.
> Approved decisions: `docs/phase-3-architecture-plan.md`.

Keep ledgers semantically separated. **Do not** derive “profit” by summing
generic signed amounts across mixed `tx_kind` values.

#### `finance_accounts`

| Column | Notes |
|--------|-------|
| `id`, `user_id` | `UNIQUE (user_id, id)` for composite FKs |
| `name`, `currency` | ISO `^[A-Z]{3}$`; account-native; locked after any cash tx **or** linked trading PnL. Cash-tx and PnL inserts take account `FOR SHARE` so they serialize with currency UPDATEs under READ COMMITTED. |
| `account_kind` | `cash`, `bank`, `brokerage`, `wallet`, `other` |
| `is_sensitive` | Default **true** |
| `is_active` | Default **true** — soft retire; no client DELETE |

#### `finance_transactions` — cash movements & recognition (typed)

Every row has exactly one `tx_kind`. `amount` is **signed** (inbound +, outbound −)
in the posting account’s native `currency` (must match account). Single `amount`
column — no parallel `revenue_amount` / `cost_amount`.

| `tx_kind` | Sign | Balance | Personal cashflow | Business profit |
|-----------|------|---------|-------------------|-----------------|
| `opening_balance` | ± | Yes (≤1/account) | **No** | **No** |
| `deposit` | + | Yes | Yes | No |
| `withdrawal` | − | Yes | Yes | No |
| `transfer` | − out / + in | Yes | No (moves) | No |
| `income` | + | Yes | Yes | No |
| `expense` | − | Yes | Yes | No |
| `business_revenue` | + | Yes | No | Yes |
| `business_cost` | − | Yes | No | Yes |
| `fee` | − | Yes | Yes (shown separately) | No |
| `other` | ± | Yes | Excluded from profit | **No** |

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `account_id` | Composite FK → account (`ON DELETE NO ACTION DEFERRABLE`) |
| `posted_on` | Civil date |
| `amount` | Finite numeric ≠ 0; sign-by-kind CHECK |
| `currency` | Must equal account native currency (`FOR SHARE` account lookup trigger) |
| `tx_kind` | See table |
| `income_category` | Required iff `income`: `employment` \| `freelance` \| `business` \| `other` |
| `expense_category` | Optional free text iff `expense` |
| `transfer_group_id` | Required for `transfer`; deferred ins/upd + del constraint triggers enforce pair + economics |
| `counterparty_account_id` | Other own account for transfers |
| `fx_rate` / `fx_rate_date` / `fx_source` | Cross-currency transfers only; `fx_source = 'user_booked'`; rate = **destination units per one source unit** |
| `notes` | Sensitive |

**Transfers — integrity layers (do not conflate):**

1. **Database-wide (deferred constraint triggers)** — two `DEFERRABLE INITIALLY
   DEFERRED` AFTER ROW triggers (INSERT/UPDATE vs DELETE; `WHEN` uses only
   `NEW`/`OLD`, not `TG_OP`). At commit, each `transfer_group_id` for a user must
   have **exactly two** legs that are economically paired: reciprocal
   counterparties, one outbound (−) and one inbound (+), shared `posted_on`,
   same-currency equal absolute amounts with **no** FX fields, or cross-currency
   matching `user_booked` FX on both legs with inbound =
   `round(source_amount * fx_rate, 8)`. Fully removed groups (`n = 0`, e.g. user
   CASCADE) are allowed. Economic field updates after insert are blocked.
   Commit-time validation takes one deterministic **per-user** transaction-scoped
   advisory lock (`personal_os.finance_transfer_validate` + `user_id`) before
   counting so two sessions cannot each commit a separate 2-leg set into the
   same group (READ COMMITTED write skew). Per-user (not per-group) avoids
   lock-order deadlocks when one transaction validates multiple groups.
   **Isolation assumption:** this concurrency design relies on PostgreSQL
   **READ COMMITTED** (Supabase/Postgres default). An advisory lock alone does
   **not** guarantee the same outcomes under **REPEATABLE READ** or
   **SERIALIZABLE**; do not raise finance-write isolation without revisiting
   transfer-group validation.
2. **RPC path** — `public.create_finance_transfer(...)` (`SECURITY INVOKER`,
   `auth.uid()` ownership, authenticated EXECUTE) is the app entry point: loads
   owned active accounts, applies same-CCY / cross-CCY rules, inserts both legs
   in one function call.
3. **GUC (limited purpose)** — session flag `personal_os.finance_transfer_rpc`
   only **authorizes INSERT** of `tx_kind = 'transfer'` rows (so clients cannot
   insert transfer rows without going through the RPC). It is **not** the
   economic integrity guarantee; crafted two-leg inserts that set the GUC still
   must pass the deferred economic pairing rules or the transaction aborts.

**Account cash balance** = `SUM(amount)` over all cash-posting kinds including
`opening_balance`. **Never** include `trading_pnl_entries`.

**Business profit** = `SUM(amount)` where `tx_kind in ('business_revenue','business_cost')` only.

**Personal cashflow** = deposit/withdrawal/income/expense/fee (fees separate in UI);
excludes opening_balance, transfers, business kinds, trading PnL.

#### `trading_pnl_entries`

Orthogonal performance ledger — **not** cash.

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `account_id?` | Optional brokerage link; composite FK |
| `traded_on` | Daily civil date; **no** unique daily constraint (multiple rows/day OK) |
| `realized_pnl` | Period-additive over a date range |
| `unrealized_pnl` | Point-in-time snapshot for that `traded_on` |
| `currency` | ISO; when `account_id` is set, must match linked account currency (trigger) |
| `notes` | Sensitive |

**Invariant:** PnL never changes cash balance; brokerage cash uses
`opening_balance` / `deposit` / `withdrawal` / `transfer` on `finance_transactions`.

#### Multi-currency reporting

- Each account has a native currency; profile `base_currency` default **RON**.
- No automatic FX provider. Reports without an explicit user rate stay
  **separated by currency**.
- Cross-currency transfers: user-booked rate only (R004 resolved for Phase 3).

### `physical_metrics`

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `recorded_on` | |
| `metric_key` | e.g. `weight_kg`, `sleep_hours` |
| `value` | Numeric |
| `unit` | |
| `notes` | |

### `behavioural_records` (sensitive)

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `recorded_on` | |
| `category` | User-defined / enum |
| `body` | Private text |
| `sensitivity` | Default `restricted` |
| `ai_accessible` | Default **false** |

### `reviews`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `chapter_id?` | |
| `period_kind` | `weekly`, `monthly`, `chapter`, `custom` |
| `period_start`, `period_end` | |
| `answers` | JSONB structured |
| `narrative` | |

### `xnine_tracking` (tracking-only)

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `title`, `status`, `notes` | |
| `external_ref` | Optional opaque string — **never** credentials |

No FKs into XNINE systems. No job runners.

### `audit_logs`

| Column | Notes |
|--------|-------|
| `id`, `user_id?` | Subject user / actor when known |
| `actor_type` | `user`, `system`, `mcp`, `agent` |
| `action` | e.g. `habit_log.create`, `finance.export`, `mcp.sensitive.read` |
| `entity_type`, `entity_id` | |
| `metadata` | JSONB; **no secrets**, no service-role material |
| `created_at` | Immutable |

**Client path:** authenticated **SELECT own only**. No INSERT/UPDATE/DELETE
privilege or policy — no generic client audit writer.

**Trusted path (deferred):** secure server-side writer or DB-trigger mechanism
for `user` / `system` / `mcp` / `agent` events — never agent-held credentials.

## Relationship sketch

```
auth.users ──< profiles
     │
     ├──< chapters ──< module_activations (chapter scope)
     ├──< module_activations (global scope)
     ├──< habits ──< habit_logs
     │                  └── recovery → original habit_logs (miss preserved)
     ├──< projects ──< milestones
     │       └──────< tasks
     ├──< milestones (standalone ok)
     ├──< tasks (inbox ok)
     ├──< check_ins
     ├──< finance_accounts ──< finance_transactions (incl. transfer pairs)
     │                    └──< trading_pnl_entries
     ├──< physical_metrics
     ├──< behavioural_records
     ├──< reviews
     ├──< xnine_tracking
     └──< audit_logs
```

## Indexes (planned)

- `(user_id, …)` leading indexes on all ownership tables
- Partial unique: one `chapters.is_current` per user
- Partial uniques for module activations (global vs chapter) as above
- `habit_logs (habit_id, logged_on)` where not recovery; recovery unique on
  `(habit_id, recovers_log_id)`
- `tasks (user_id, status, due_on)`
- `finance_accounts (user_id, is_active)`
- `finance_transactions (user_id, account_id, posted_on)`; `(user_id, tx_kind, posted_on)`;
  `(user_id, transfer_group_id)`; partial unique opening_balance; transfer group+account unique
- `trading_pnl_entries (user_id, traded_on)`
- `audit_logs (user_id, created_at desc)`

## RLS + privileges (Phase 1B draft)

Aligned with `docs/SECURITY.md` and `docs/PHASE_1B_L3_STOP.md`:

- Enable RLS on every user-data table.
- Policies: `auth.uid() = user_id` for SELECT/INSERT/UPDATE. **No DELETE policies**
  for authenticated clients on domain tables (prefer close/deactivate/status).
- Explicit `REVOKE ALL` from `anon`/`authenticated`, then grant only needed DML.
- `profiles`: users read/insert/update own row only.
- `audit_logs`: SELECT own only; no client INSERT/UPDATE/DELETE; trusted writing deferred.
- Trigger/security functions: EXECUTE revoked from API roles; `handle_new_user`
  EXECUTE only for `supabase_auth_admin`.
- `is_valid_habit_cadence(jsonb)`: EXECUTE for `authenticated` only (CHECK path);
  revoked from anon / service_role / PUBLIC.
- Account deletion: user-owned rows CASCADE from `auth.users`; habit history FKs
  are deferred NO ACTION so purge works without allowing single-habit history wipe.
- Sensitive tables: ownership RLS **plus** app/MCP authorization gates.
- Composite FKs complement RLS (integrity); they do not replace RLS.
- Service role: process-local on Next.js server / MCP **host** only — never in
  browser, never returned to Cursor/agents, never in tool responses.

SQL test drafts (not executed until authorized): `supabase/tests/`.

## Migration strategy

1. Require a **dedicated EU development** Supabase project before any real schema
   experimentation (D015). Do not assume any existing hosted project is linked
   or safe to modify.
2. Author versioned SQL in `supabase/migrations/` (timestamped) against that
   **dev** target only after L3 approval.
3. Production project (separate) receives migrations only via explicit later L3.
4. Never use XNINE projects or credentials.
5. Docker local Supabase remains **optional and stopped** (D018).
6. No seed of production-like personal data in git.

## Out of scope until authorized

- Creating tables
- `db push` / `migration up`
- Editing hosted schemas via MCP or dashboard automation
- Touching any project that is not the approved Personal OS **dev** project
