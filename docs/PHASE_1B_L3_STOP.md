# Phase 1B — L3 stop package (awaiting apply approval)

> **Status after L3 review corrections:** migration + auth + docs updated on
> branch. **Migration still NOT applied.** Docker not started. Hosted Auth
> settings not changed by the agent.

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

Includes: `profiles` (+ hardened signup trigger), `chapters`, `module_activations`,
`habits`, `habit_logs`, `projects`, `milestones`, `tasks`, `audit_logs`.

### L3 review corrections baked into this draft

1. **Composite FK delete actions (PG17 column lists)**
   - `habits.chapter_id` → `ON DELETE SET NULL (chapter_id)`
   - `projects.chapter_id` → `ON DELETE SET NULL (chapter_id)`
   - `milestones.project_id` → `ON DELETE SET NULL (project_id)`
   - `tasks.project_id` / `tasks.milestone_id` → `ON DELETE SET NULL (…)`
   - `user_id` is never nullified by those FKs
   - `habit_logs` → `habits` is `ON DELETE RESTRICT` (preserve history)
   - chapter-scoped `module_activations` still `ON DELETE CASCADE` (disposable config)
2. **Explicit privileges** — revoke all from `anon`/`authenticated`, then grant
   only `SELECT/INSERT/UPDATE` (audit: `SELECT/INSERT` only). No client
   `DELETE`/`TRUNCATE`/`REFERENCES`/`TRIGGER`/`MAINTAIN`. No service-role to agents.
3. **No authenticated hard-delete** — no DELETE policies on chapters, habits,
   habit_logs, projects, milestones, tasks (prefer close/deactivate/status).
4. **Audit integrity** — insert `WITH CHECK (actor_type = 'user' AND user_id = auth.uid())`;
   no client UPDATE/DELETE. Trusted-server path documented for non-user actors.
5. **`handle_new_user()`** — `search_path = ''`, schema-qualified, execute limited
   to `supabase_auth_admin`; same `search_path` hardening on habit triggers.

## 3. Final privilege matrix (intended after apply)

| Table | anon | authenticated |
|-------|------|---------------|
| `profiles` | none | SELECT, INSERT, UPDATE |
| `chapters` | none | SELECT, INSERT, UPDATE |
| `module_activations` | none | SELECT, INSERT, UPDATE |
| `habits` | none | SELECT, INSERT, UPDATE |
| `habit_logs` | none | SELECT, INSERT, UPDATE |
| `projects` | none | SELECT, INSERT, UPDATE |
| `milestones` | none | SELECT, INSERT, UPDATE |
| `tasks` | none | SELECT, INSERT, UPDATE |
| `audit_logs` | none | SELECT, INSERT |

`service_role` retains Supabase bypass for host processes only — **never** agent-held.

## 4. Final RLS policy matrix (intended after apply)

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `profiles` | own `id` | own `id` | own `id` | — |
| `chapters` | own `user_id` | own | own | — |
| `module_activations` | own | own | own | — |
| `habits` | own | own | own | — |
| `habit_logs` | own | own | own | — |
| `projects` | own | own | own | — |
| `milestones` | own | own | own | — |
| `tasks` | own | own | own | — |
| `audit_logs` | own `user_id` | `actor_type='user'` ∧ `user_id=auth.uid()` | — | — |

## 5. FK deletion behaviour

| Child | Parent link | On parent delete |
|-------|-------------|------------------|
| `habits` | `chapters` | SET NULL **only** `chapter_id` |
| `projects` | `chapters` | SET NULL **only** `chapter_id` |
| `milestones` | `projects` | SET NULL **only** `project_id` |
| `tasks` | `projects` | SET NULL **only** `project_id` |
| `tasks` | `milestones` | SET NULL **only** `milestone_id` |
| `habit_logs` | `habits` | **RESTRICT** (blocks habit hard-delete while logs exist) |
| `module_activations` (chapter) | `chapters` | CASCADE |
| recovery `habit_logs` | original log | RESTRICT |

## 6. Auth security changes (app code; hosted Auth untouched)

- `safeNextPath()` — same-origin relative only; rejects absolute, protocol-relative,
  backslash, embedded `://`; fallback `/`. Used on login page + callback.
- Magic link: `shouldCreateUser: false` — **no public signup**; first account is
  created manually in the DEV dashboard (see `docs/AUTH_DEV_SETUP.md`).
- RLS ownership unchanged (publishable key + user JWT).

## 7. SQL tests

Under `supabase/tests/` (`rls_privileges.sql`, `fk_delete_behaviour.sql`,
`audit_recovery.sql` + README).

**Executed this pass?** **No** — authored only. Docker not started; hosted DB
not mutated.

## 8. Habit cadence v1 (unchanged product rules)

- `daily` or selected ISO weekdays `1..7`, with `startOn` / optional `endOn`.
- Dual metrics: target attainment + minimum adherence; unlogged counted.
- Recovery never rewrites primary history.

## 9. Remaining risks before/after apply

- PostgREST `onConflict` with partial unique indexes for modules uses a manual
  fallback path — verify after apply.
- End-to-end CRUD Playwright against live DEV needs applied schema + a real
  magic-link inbox + a manually created first user.
- Confirm Site URL + redirect allowlist on DEV before relying on magic links
  (**human** Auth checklist — agent did not change hosted Auth).
- PG17 column-specific `SET NULL (col)` must be verified in catalog after apply.
- Until L3 apply, data pages show honest “unavailable / no rows” states.

## Apply command (only after explicit L3)

Human-approved example (do **not** run until told):

```bash
npx supabase db push --project-ref qyysmgwdvhftbgwhpbjt
```

(or the exact apply workflow the human prefers)
