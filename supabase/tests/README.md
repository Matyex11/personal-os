# Phase 1B SQL tests (authored — not executed)

These scripts are **draft assertions** for personal-os-dev after the Phase 1B
migration is L3-approved and applied. They are **not** run in this agent pass.

## Constraints

- **Do not start Docker** to execute these.
- **Do not** run against hosted DEV until the migration is applied and a human
  authorizes DB test execution.
- Until then, treat them as review artifacts that encode expected RLS, grants,
  FK deletion behaviour, audit integrity, and recovery constraints.

## Files

| File | Covers |
|------|--------|
| `rls_privileges.sql` | anon denied; authenticated grants; no DELETE; own vs cross-user |
| `fk_delete_behaviour.sql` | column-specific `SET NULL`; restrict on habit history |
| `audit_recovery.sql` | audit actor_type; recovery immutability; cross-user FKs |

## Intended runner (future, human-approved)

pgTAP / `supabase test db` / SQL Editor as a **read-only review** session — never
as silent agent automation against unknown projects.
