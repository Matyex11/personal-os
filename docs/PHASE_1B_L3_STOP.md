# Phase 1B — L3 stop package (awaiting apply approval)

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

Includes: `profiles` (+ signup trigger), `chapters`, `module_activations`,
`habits`, `habit_logs`, `projects`, `milestones`, `tasks`, `audit_logs`.

## 3. RLS policy explanation

- Every user-data table: RLS enabled.
- `authenticated` policies use `auth.uid() = user_id` (or `id` for profiles).
- `audit_logs`: SELECT + INSERT own only — **no** UPDATE/DELETE policies for clients.
- Browser/server app uses publishable key + user JWT only (no service-role for routine ops).

## 4. Ownership + recovery integrity

- Composite FKs `(user_id, parent_id)` on chapter-scoped and child tables.
- Module activation partial uniques for global vs chapter scope.
- Chapter lifecycle CHECKs (planned/active/closed + current rules).
- Habit logs: recovery nullness CHECK; composite FK for recovery target; unique
  primary log per habit/date; recovery insert trigger requires same user/habit
  and original status `missed|partial`; update trigger blocks rewriting
  missed/partial status and blocks mutating logs that already have recoveries.

## 5. Habit cadence v1

- `daily` or selected ISO weekdays `1..7`, with `startOn` / optional `endOn`.
- Schedule generation is pure (`generateScheduledDates`); reporting consumes
  expected dates + that habit’s logs for the authenticated user only.
- `not_scheduled` log overrides exclude a day from the denominator.
- No historical backfill; cadence changes do not mutate old logs.

## 6. Auth (code ready; hosted settings need human)

- `@supabase/ssr` browser + server clients, `src/proxy.ts` refresh via `getClaims()`,
  magic link + `/auth/callback` + sign-out, protected routes.
- Checklist: `docs/AUTH_DEV_SETUP.md` — **do not silently alter** hosted Auth.

## 7. Remaining risks before/after apply

- PostgREST `onConflict` with partial unique indexes for modules uses a manual
  fallback path — verify after apply.
- End-to-end CRUD Playwright against live DEV needs applied schema + a real
  magic-link inbox.
- Until L3 apply, data pages show honest “unavailable / no rows” states when
  tables are missing.
- Confirm Site URL + redirect allowlist on DEV before relying on magic links.

## Apply command (only after explicit L3)

Human-approved example (do **not** run until told):

```bash
npx supabase db push --project-ref qyysmgwdvhftbgwhpbjt
```

(or the exact apply workflow the human prefers)
