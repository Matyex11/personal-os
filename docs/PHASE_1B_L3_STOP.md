# Phase 1B — L3 stop package (awaiting apply approval)

> **Status after final L3 corrections (post-`f71b8f9`):** migration + auth + docs
> updated on branch. **Migration still NOT applied.** Docker not started. Hosted
> Auth settings not changed by the agent.

## 1. Exact migration target

| Field | Value |
|-------|-------|
| Name | `personal-os-dev` |
| Reference | `qyysmgwdvhftbgwhpbjt` |
| Region | `eu-central-1` (EU) |
| Status at preflight | `ACTIVE_HEALTHY`, linked |

**Do not apply** to `personal-os` (`bdmhlzbigdedqsqirwxn`) or any other project.

## 2. Migration SQL

File: `supabase/migrations/20261122190000_phase1b_core.sql`

### Final L3 corrections (this pass)

**A. Function EXECUTE**
- `REVOKE ALL` from `PUBLIC`, `anon`, `authenticated`, `service_role` on
  `handle_new_user`, `enforce_habit_recovery_insert`, `enforce_habit_log_immutability`
- `GRANT EXECUTE` on `handle_new_user()` **only** to `supabase_auth_admin`
- No API-role EXECUTE on habit trigger functions (migration owner creates triggers)
- Migration-end `has_function_privilege()` assertions fail the migration if wrong

**B. Audit**
- authenticated: **SELECT own only** — no INSERT privilege, no INSERT policy
- Trusted audit writing deferred until secure server-side or DB-trigger mechanism

**C. Cadence / values**
- `public.is_valid_habit_cadence(jsonb)` + `habits_cadence_v1` CHECK
- `habits_min_nonneg` (`min_value >= 0`); `habit_logs_value_nonneg`
- App: `createHabitSchema` includes `habitCadenceSchema`; `createHabit()` is the
  server-only write boundary (DB CHECK is defence in depth)

## 3. Final privilege matrix (intended after apply)

| Table | anon | authenticated |
|-------|------|---------------|
| `profiles` … `tasks` (domain) | none | SELECT, INSERT, UPDATE |
| `audit_logs` | none | **SELECT only** |

### Function EXECUTE

| Function | anon | authenticated | service_role | supabase_auth_admin |
|----------|------|---------------|--------------|---------------------|
| `handle_new_user()` | — | — | — | EXECUTE |
| `enforce_habit_recovery_insert()` | — | — | — | — |
| `enforce_habit_log_immutability()` | — | — | — | — |
| `is_valid_habit_cadence(jsonb)` | — | — | — | — |

## 4. Final RLS policy matrix (intended after apply)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| domain tables + profiles | own | own | own | — |
| `audit_logs` | own `user_id` | — | — | — |

## 5. FK deletion behaviour

| Child | Parent link | On parent delete |
|-------|-------------|------------------|
| `habits` / `projects` | `chapters` | SET NULL **only** `chapter_id` |
| `milestones` | `projects` | SET NULL **only** `project_id` |
| `tasks` | projects / milestones | SET NULL **only** that column |
| `habit_logs` | `habits` | **RESTRICT** |
| chapter `module_activations` | `chapters` | CASCADE |
| recovery log | original log | RESTRICT |

## 6. Auth security (unchanged this pass; hosted Auth untouched)

- `safeNextPath()`; magic link `shouldCreateUser: false`; manual first account.

## 7. SQL tests

| File | Executed? |
|------|-----------|
| `supabase/tests/01_privileges_and_functions.sql` | **No** (authored) |
| `supabase/tests/02_rls_and_audit.sql` | **No** (authored) |
| `supabase/tests/03_fk_cadence_recovery.sql` | **No** (authored) |

Executable `RAISE EXCEPTION` assertions (not NOTICE-only). Docker not started.

## 8. Remaining risks

- Schema unapplied until separate L3 apply approval
- Seeded `auth.users` inserts in SQL tests assume Supabase auth column layout
- Verify `has_function_privilege` / trigger fire behaviour on hosted PG17 after apply
- Trusted audit writer still unimplemented (by design this pass)
- Parent `node@18` on user PATH can poison `npm run` — use system Node ≥20.9

## Apply command (only after explicit L3)

```bash
npx supabase db push --project-ref qyysmgwdvhftbgwhpbjt
```
