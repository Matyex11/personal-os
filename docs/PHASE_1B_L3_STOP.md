# Phase 1B — L3 stop package (awaiting apply approval)

> **Status after post-`b707034` L3 corrections:** migration + SQL tests + docs
> updated. **Migration still NOT applied.** Docker not started. Hosted Auth
> unchanged. Target remains **personal-os-dev** / `qyysmgwdvhftbgwhpbjt` /
> `eu-central-1` only. Do **not** touch `personal-os` (`bdmhlzbigdedqsqirwxn`).

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

**B. Fail-closed cadence**
- Always returns TRUE/FALSE (never NULL); CHECK uses `… IS TRUE`
- Aligns with `habitCadenceSchema` / `cadence.ts`

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
- `weekdays` kind: array of 1–7 integer entries each in 1..7 (no decimals/strings/empty)
Accept → TRUE:
- valid daily (optional `weekdays` ignored)
- valid weekdays with ISO weekdays + optional `endOn`

## 6. FK deletion behaviour

| Child | Parent | On delete |
|-------|--------|-----------|
| habits/projects | chapters | SET NULL (**only** `chapter_id`) PG17 |
| milestones | projects | SET NULL (**only** `project_id`) |
| tasks | projects / milestones | SET NULL (**only** that column) |
| habit_logs | habits | **NO ACTION DEFERRABLE** (history-preserving) |
| recovery log | original log | **NO ACTION DEFERRABLE** |
| chapter module_activations | chapters | CASCADE |
| user-owned rows | `auth.users` | CASCADE (account purge) |

## 7. SQL tests (authored — **not executed**)

| File | Focus |
|------|-------|
| `01_privileges_and_functions.sql` | grants + cadence EXECUTE + valid habit insert |
| `02_rls_and_audit.sql` | RLS own/cross-user; no DELETE; audit insert denial |
| `03_fk_cadence_recovery.sql` | cadence cases; SET NULL; NO ACTION; recovery |
| `04_account_deletion.sql` | account purge; no orphans |

## 8. Remaining risks

- Schema unapplied until separate L3 apply
- SQL tests assume Supabase `auth.users` column layout
- Deferred FK semantics should be verified on hosted PG17 after apply
- Trusted audit writer still deferred
- No XNINE; no service-role to agents; `.env.local` untouched

## Apply (only after explicit later L3)

```bash
npx supabase db push --project-ref qyysmgwdvhftbgwhpbjt
```
