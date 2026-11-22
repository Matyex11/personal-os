# Personal OS

Private, modular life-operating system. Answers three questions: **Where am I?**,
**What matters now?**, and **How did I actually do?**

## Status

**Phase 0 — Foundation.** Documentation, Cursor agent organization, and repo
structure are in place. No app scaffold, no applied migrations, no deploy.
Awaiting human review before Phase 1.

## Docs

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](./AGENTS.md) | Roles, autonomy (L1/L2/L3), collaboration |
| [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md) | Mission, modules, principles |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Stack, layout, testing strategy |
| [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Conceptual schema (not applied) |
| [docs/MCP_SPEC.md](./docs/MCP_SPEC.md) | Personal OS MCP (not XNINE) |
| [docs/SECURITY.md](./docs/SECURITY.md) | RLS, sensitive modules, approvals |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Phases; Phase 1 is the next build |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | Decisions + unresolved questions |

## Hard constraints

- Do not start Docker unless explicitly approved.
- Do not apply hosted Supabase migrations without L3 approval.
- Never commit secrets; never reuse XNINE credentials or execution infra.
- XNINE module is tracking-only.

## Repo layout

```
AGENTS.md
.cursor/rules|agents|commands
docs/
src/                 # placeholder until Phase 1 scaffold
supabase/            # config preserved; migrations empty
tests/               # unit + e2e placeholders
```

## Next phase

See **Phase 1** in `docs/ROADMAP.md`: scaffold the modular monolith, draft core
migrations + RLS, auth, and a vertical slice (habits + projects/milestones/tasks).
