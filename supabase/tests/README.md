# Phase 1B SQL tests (executable assertions — not run this pass)

Transactional SQL with `RAISE EXCEPTION` on failure. Intended for
`supabase test db` / SQL Editor **after** L3 apply to personal-os-dev.

## Constraints

- **Do not start Docker** in agent passes unless explicitly approved.
- **Do not** run against hosted DEV until migration apply is approved.
- This agent pass: **authored only — not executed.**

## Files

| File | Covers |
|------|--------|
| `01_privileges_and_functions.sql` | Table privileges; function EXECUTE via `has_function_privilege` |
| `02_rls_and_audit.sql` | Own vs cross-user RLS; no DELETE; audit insert denial |
| `03_fk_cadence_recovery.sql` | Composite FK ownership; SET NULL (col); habit RESTRICT; recovery |

## Runner (future, human-approved)

```bash
# Example only — do not run until authorized:
# npx supabase test db
```
