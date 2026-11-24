# Phase 1B — L3 stop package (historical apply record)

> **Current status (P2.4 docs reconciliation):** migration `20261122190000`
> **applied** on **personal-os-dev** / `qyysmgwdvhftbgwhpbjt` / `eu-central-1`;
> SQL integrity scripts **passed** (human). Docker still not started. Hosted Auth
> changes remain L3-gated. Do **not** touch `personal-os` (`bdmhlzbigdedqsqirwxn`).
> Body below is the **pre-apply** stop package kept for audit; prefer
> `docs/ROADMAP.md` and `docs/AUTH_DEV_SETUP.md` for live Phase 1B status.

## 1. Exact migration target

| Field | Value |
|-------|-------|
| Name | `personal-os-dev` |
| Reference | `qyysmgwdvhftbgwhpbjt` |
| Region | `eu-central-1` (EU) |

## 2. This correction pass (smallest focused commit)

**A. Cadence-validator privileges**
- `is_valid_habit_cadence(jsonb)`: IMMUTABLE, SECURITY INVOKER, fail-closed
- `REVOKE` from PUBLIC / anon / service_role; **`GRANT EXECUTE` to authenticated**
  (required for CHECK on authenticated INSERT/UPDATE)

**B. Fail-closed cadence (Zod parity)**
- Always returns TRUE/FALSE (never NULL); CHECK uses `… IS TRUE`
- `kind=weekdays` → `weekdays` required; `kind=daily` → optional
- **If `weekdays` is present (any kind):** must be array of 1–7 integers 1..7
- Aligns with `habitCadenceSchema` / `cadence.ts` (Zod not loosened)

**Deferred history FKs (named)**
- `habit_logs_habit_fkey`, `habit_logs_recovery_fkey`
- Tests force `SET CONSTRAINTS <name> IMMEDIATE` after individual DELETE attempts
- Account purge: `SET CONSTRAINTS ALL IMMEDIATE` after `DELETE auth.users`

**C. SQL tests repaired** — executable assertions; see §7

**D. Account deletion**
- `habit_logs → habits` and recovery self-FK: `ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED`
- Individual habit / original-log deletes still fail while dependents exist
- `DELETE auth.users` CASCADE purge succeeds in one transaction (no history CASCADE on single-habit delete)

## 3. Final privilege matrix (tables)

| Table | anon | authenticated |
|-------|------|---------------|
| domain (`profiles`…`tasks`) | none | SELECT, INSERT, UPDATE |
| `audit_logs` | none | SELECT only |

## 4. Final function privilege matrix

| Function | anon | authenticated | service_role | supabase_auth_admin |
|----------|------|---------------|--------------|---------------------|
| `handle_new_user()` | — | — | — | EXECUTE |
| `enforce_habit_recovery_insert()` | — | — | — | — |
| `enforce_habit_log_immutability()` | — | — | — | — |
| `is_valid_habit_cadence(jsonb)` | — | **EXECUTE** | — | — |

## 5. Cadence validation rules (app + DB)

Reject → FALSE / Zod fail:
- NULL / non-object
- missing / invalid `kind` (only `daily` \| `weekdays`)
- missing / non-string / non-calendar `startOn` (`YYYY-MM-DD`)
- `endOn` present and not JSON null: must be valid calendar date ≥ `startOn`
- if `weekdays` present (any kind): array of 1–7 integer entries each in 1..7
  (no decimals/strings/null/objects/empty/out-of-range)
- `weekdays` kind without `weekdays` key → FALSE
Accept → TRUE:
- valid daily (no weekdays, or optional **valid** weekdays array)
- valid weekdays with ISO weekdays + optional `endOn`

## 6. FK deletion behaviour

| Child | Parent | On delete |
|-------|--------|-----------|
| habits/projects | chapters | SET NULL (**only** `chapter_id`) PG17 |
| milestones | projects | SET NULL (**only** `project_id`) |
| tasks | projects / milestones | SET NULL (**only** that column) |
| habit_logs | habits | **`habit_logs_habit_fkey`** NO ACTION DEFERRABLE |
| recovery log | original log | **`habit_logs_recovery_fkey`** NO ACTION DEFERRABLE |
| chapter module_activations | chapters | CASCADE |
| user-owned rows | `auth.users` | CASCADE (account purge) |

## 7. SQL tests (authored; later executed on DEV — human)

| File | Focus |
|------|-------|
| `01_privileges_and_functions.sql` | grants + cadence EXECUTE + valid habit insert |
| `02_rls_and_audit.sql` | RLS own/cross-user; no DELETE; audit insert denial |
| `03_fk_cadence_recovery.sql` | cadence cases; SET NULL; NO ACTION; recovery |
| `04_account_deletion.sql` | account purge; no orphans |

## 8. Remaining risks (post-apply)

- Further schema changes still require explicit L3 on the named DEV project
- SQL tests assume Supabase `auth.users` column layout
- Trusted audit writer still deferred
- No XNINE; no service-role to agents; `.env.local` untouched
- Phase 1B product acceptance review still pending (see `docs/ROADMAP.md`)

## Apply (historical — already done for `20261122190000` on DEV)

```bash
npx supabase db push --project-ref qyysmgwdvhftbgwhpbjt
```

Do **not** re-run against PROD or an unnamed project. New migrations need a fresh L3.
