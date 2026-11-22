# Personal OS — Database Schema (Conceptual)

> **Status:** Design only. **No migrations applied.** No hosted tables created or
> modified in the foundation phase. SQL under `supabase/migrations/` may be
> added in a later approved phase.

## Design goals

1. Every user-owned row includes `user_id` (FK → `auth.users`) and is protected by RLS.
2. Chapters scope “what is active now” without deleting history.
3. Projects, milestones, and tasks are **separate concepts** with optional links.
4. Habit logs use an explicit status enum including Recovery.
5. Finance semantics stay strict (PnL ≠ cash movement; revenue ≠ profit).
6. Behavioural + detailed financial data are **sensitive** — not default AI/MCP readable.
7. Audit log is append-oriented for important mutations.

## Core entities

### `profiles`

Extends auth user with app preferences.

| Column | Notes |
|--------|-------|
| `id` PK | Same as `auth.users.id` |
| `display_name` | |
| `timezone` | IANA TZ |
| `base_currency` | Default reporting currency (e.g. `HUF`, `EUR`) |
| `created_at` / `updated_at` | |

### `chapters`

Named life periods / history frames.

| Column | Notes |
|--------|-------|
| `id` PK | UUID |
| `user_id` | Owner |
| `title`, `summary` | |
| `started_on`, `ended_on` | `ended_on` null = current/open |
| `is_current` | At most one current chapter per user (enforced by partial unique index) |

**Relationships:** Parent of module activations, optional FK target from habits/projects/check-ins/reviews.

### `module_activations`

Which product modules are live for a user (optionally within a chapter).

| Column | Notes |
|--------|-------|
| `id` PK | |
| `user_id` | |
| `chapter_id` | Nullable = global preference; prefer chapter-scoped |
| `module_key` | Enum/text: `habits`, `tasks`, `projects`, `milestones`, `checkins`, `finances`, `physical`, `behavioural`, `reviews`, `xnine_tracking` |
| `is_active` | |
| `settings` | JSONB module-specific flags |

**Constraint:** Unique `(user_id, chapter_id, module_key)`.

### `habits`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `chapter_id?` | |
| `name`, `description` | |
| `cadence` | e.g. daily / weekly / custom RRULE later |
| `min_value` | Minimum acceptable quantity (numeric or boolean-as-0/1) |
| `target_value` | Aspirational target (≥ min) |
| `unit` | Optional (`minutes`, `reps`, …) |
| `is_active` | |

### `habit_logs`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `habit_id` | |
| `logged_on` | Date in user TZ intent |
| `status` | Enum: `completed`, `partial`, `missed`, `not_scheduled`, `recovery` |
| `value` | Actual amount; null when not applicable |
| `notes` | |
| `is_recovery_for` | Optional FK → prior `habit_logs.id` when status = `recovery` |

**Rules:**

- `completed`: meets/exceeds **target** (or boolean done).
- `partial`: meets **min** but below target (or explicitly partial).
- `missed`: scheduled and not done.
- `not_scheduled`: off-cadence day; does not punish streaks.
- `recovery`: intentional make-up; does not silently rewrite history.
- Unique `(habit_id, logged_on)` for non-recovery rows; recoveries may reference the missed log.

### `projects`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `chapter_id?` | |
| `title`, `description` | |
| `status` | `active`, `paused`, `done`, `dropped` |
| `priority` | Optional ordinal |
| `target_date` | Optional |

### `milestones`

**Not** a project subtype and **not** a task.

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `project_id` | Optional FK — milestone may stand alone |
| `title`, `description` | |
| `status` | `pending`, `hit`, `missed`, `cancelled` |
| `target_on`, `achieved_on` | |

### `tasks`

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `project_id?`, `milestone_id?` | Optional links; task can be inbox-only |
| `title`, `notes` | |
| `status` | `todo`, `doing`, `done`, `cancelled` |
| `due_on`, `completed_at` | |

### `check_ins`

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `chapter_id?` | |
| `checked_on` | |
| `mood` / scores | Structured fields TBD |
| `body` | Free text (may be sensitive — treat as elevated) |
| `prompt_set_key` | Which questionnaire version |

### Finances

Split for semantic honesty:

#### `finance_accounts`

Cash / brokerage / wallet containers.

| Column | Notes |
|--------|-------|
| `id`, `user_id` | |
| `name`, `currency` | ISO currency |
| `account_kind` | `cash`, `bank`, `brokerage`, `wallet`, `other` |
| `is_sensitive` | Default true for detailed ledgers |

#### `finance_transactions`

Cash movements and categorized income/expense—**not** trading marks.

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `account_id` | |
| `posted_on` | |
| `amount` | Signed; currency from account or explicit `currency` |
| `tx_kind` | `deposit`, `withdrawal`, `transfer`, `income`, `expense`, `fee`, `other` |
| `income_category` | Null unless income: `employment`, `freelance`, `business`, `other` |
| `revenue_amount` / `cost_amount` | Optional split when tracking profit ≠ revenue |
| `notes` | Sensitive |

**Invariant:** Deposits/withdrawals never invent PnL.

#### `trading_pnl_entries`

Mark-to-market or realized trading results—**orthogonal** to deposits/withdrawals.

| Column | Notes |
|--------|-------|
| `id`, `user_id`, `account_id?` | |
| `period_start`, `period_end` | Or `traded_on` for per-trade |
| `realized_pnl`, `unrealized_pnl` | |
| `currency` | |
| `notes` | Sensitive |

**Invariant:** Summing PnL must not be presented as cash balance change.

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
| `id`, `user_id?` | Actor when known |
| `actor_type` | `user`, `system`, `mcp`, `agent` |
| `action` | e.g. `habit_log.create`, `finance.export`, `mcp.sensitive.read` |
| `entity_type`, `entity_id` | |
| `metadata` | JSONB; **no secrets** |
| `created_at` | Immutable |

## Relationship sketch

```
auth.users ──< profiles
     │
     ├──< chapters ──< module_activations
     ├──< habits ──< habit_logs
     ├──< projects ──< milestones
     │       └──────< tasks
     ├──< milestones (standalone ok)
     ├──< tasks (inbox ok)
     ├──< check_ins
     ├──< finance_accounts ──< finance_transactions
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
- `habit_logs (habit_id, logged_on)`
- `tasks (user_id, status, due_on)`
- `finance_transactions (account_id, posted_on)`
- `trading_pnl_entries (user_id, period_end)`
- `audit_logs (user_id, created_at desc)`

## RLS approach (conceptual)

- Enable RLS on every user-data table.
- Policies: `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE (as appropriate).
- `profiles`: users read/update own row only.
- `audit_logs`: insert via trusted server/MCP paths; users can SELECT own rows; no UPDATE/DELETE for clients.
- Sensitive tables (`behavioural_records`, finance details): same RLS ownership **plus** application/MCP gates (`ai_accessible`, confirmation, audit). RLS alone is insufficient for “AI must not see this.”
- Service role: server-only; never in client bundles or MCP tool defaults without explicit admin tools + L3.

## Migration strategy

1. Author versioned SQL in `supabase/migrations/` (timestamped).
2. Human reviews SQL + RLS in PR.
3. Apply to **hosted Personal OS** Supabase only after L3 approval.
4. Do **not** use XNINE projects or credentials.
5. Local Docker Supabase remains optional and off by default.
6. No seed of production-like personal data in git.

## Out of scope for foundation

- Creating tables
- `db push` / `migration up`
- Editing hosted schemas via MCP or dashboard automation
