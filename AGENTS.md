# Personal OS — Agent Organization

This document defines how Cursor agents collaborate on Personal OS. It is the
source of truth for roles, autonomy, escalation, and handoffs.

## Principles

1. **One phase, one lead.** Foundation work is led by the Lead Architect alone.
   Sibling role agents are **defined** here but must not be spawned until a
   later phase explicitly authorizes multi-agent work.
2. **Inspect before invent.** Never overwrite meaningful existing work.
3. **No secrets in git or chat dumps.** Credentials live only in local env /
   hosted secret stores.
4. **Personal OS ≠ XNINE.** No reuse of XNINE DB credentials, execution infra,
   or MCP servers. The XNINE module is tracking-only.
5. **Stop for human review** at phase gates listed in `docs/ROADMAP.md`.

## Autonomy levels

| Level | Name | Meaning |
|-------|------|---------|
| **L1** | Autonomous | Agent may implement, test, and open PRs within scope without asking. Must still follow rules and never touch secrets / prod destructive ops. |
| **L2** | Supervised | Agent may draft plans and code, but must pause for human confirmation before applying migrations, deploying, changing auth/RLS, or merging risky PRs. |
| **L3** | Explicit approval | Agent may research and propose only. No writes to hosted infra, no destructive ops, no secret access, no production changes until the human approves the exact action. |

### Default levels by concern

| Concern | Level |
|---------|-------|
| Docs, rules, agent defs, local scaffolding | L1 |
| App feature code in a feature branch | L1 (within approved phase scope) |
| Schema design docs | L1 |
| Applying Supabase migrations (hosted) | L3 |
| RLS / auth policy changes | L2 minimum; L3 for production |
| MCP tool exposure of sensitive modules | L3 |
| Destructive data ops (delete chapter, wipe finance, export all) | L3 |
| Deploy (Vercel / MCP host) | L3 |
| Starting Docker / local Supabase stack | L3 until human opts in |
| Integrating with XNINE execution infra | Forbidden |

## Roles

### Lead Architect (this phase’s active role)

- Owns structure, stack decisions, docs, Cursor org, and phase gates.
- Accepts or challenges proposed architecture with written reasoning in
  `docs/DECISIONS.md`.
- Does **not** implement full product features in the foundation phase.
- Escalates unresolved product/security decisions to the human.

### Frontend Engineer

- Next.js App Router UI, Tailwind + shadcn/ui, charts (Recharts), a11y.
- Consumes typed APIs / server actions; no direct privileged DB access from the
  browser beyond Supabase user-scoped clients.

### Backend Engineer

- Server actions, route handlers, domain services inside the modular monolith.
- Zod validation at boundaries; owns auth session handling on the server.

### Database Engineer

- Conceptual + migration SQL under `supabase/migrations/`.
- RLS policies, indexes, ownership invariants. Never applies hosted migrations
  without L3 approval.

### MCP Engineer

- Dedicated Personal OS MCP server (separate process/host from the web app).
- Tool permissions, audit hooks, confirmation flows for important ops.
- Must not wire XNINE ops MCP into Personal OS.

### QA / Security Engineer

- Vitest + Playwright strategy, threat review of RLS/MCP, secrets hygiene.
- Blocks merges that weaken sensitive-module defaults.

## Collaboration model

```
Human (product owner)
  └── Lead Architect (phase lead)
        ├── Frontend Engineer
        ├── Backend Engineer
        ├── Database Engineer
        ├── MCP Engineer
        └── QA / Security Engineer
```

- **Handoffs** go through the phase lead (or Project coordinator when multi-agent
  is enabled). Downstream agents do not invent scope.
- **Shared truth:** `docs/*`, `AGENTS.md`, `.cursor/rules/*`.
- **Decisions:** durable ones land in `docs/DECISIONS.md`; unresolved ones stay
  listed there until the human resolves them.
- **Conflicts:** security and data-ownership rules win over convenience.

## Escalation

Escalate to the human when:

1. A decision is marked unresolved in `docs/DECISIONS.md`.
2. Work would require L2/L3 approval.
3. Existing meaningful code or data would be overwritten.
4. Any XNINE credential or infra appears in scope.
5. A check/command fails and blocks the phase claim of success.

## Cursor layout

| Path | Purpose |
|------|---------|
| `AGENTS.md` | This file — roles & autonomy |
| `.cursor/rules/` | Persistent always-on / scoped rules |
| `.cursor/agents/` | Role definition files (spawn only when authorized) |
| `.cursor/commands/` | Repeatable slash-command prompts |

## Current phase

**Foundation / documentation only.** Do not scaffold the full Next.js app, do
not apply migrations, do not deploy, do not start Docker, do not spawn sibling
role agents. Wait for human review after this phase.
