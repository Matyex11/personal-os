# Personal OS — Agent Organization

This document defines how Cursor agents collaborate on Personal OS. It is the
source of truth for roles, autonomy, escalation, and handoffs. Phase gates in
`docs/ROADMAP.md` further restrict what “in scope” means.

## Principles

1. **One phase, one lead.** Foundation / architecture-review work is led by the
   Lead Architect alone. Sibling role agents are **defined** under
   `.cursor/agents/` but must not be spawned until a later phase explicitly
   authorizes multi-agent work.
2. **Inspect before invent.** Never overwrite meaningful existing work.
3. **No secrets in git or chat dumps.** Credentials live only in local env /
   hosted secret stores. **Never** expose service-role keys to agents.
4. **Personal OS ≠ XNINE.** No reuse of XNINE DB credentials, execution infra,
   or MCP servers. The XNINE module is tracking-only.
5. **Environment separation.** Schema experiments require a dedicated **EU DEV**
   Supabase project. Do not assume any existing hosted project is linked or safe.
   Docker stays stopped unless L3 opts in.
6. **Stop for human review** at phase gates listed in `docs/ROADMAP.md`.

## Autonomy levels

| Level | Name | Meaning |
|-------|------|---------|
| **L1** | Autonomous | Agent may implement, test, and prepare commits/PRs **within the authorized phase scope**. Must never touch secrets, start Docker, or mutate hosted infra. |
| **L2** | Supervised | Agent may draft plans and risky diffs (auth/RLS SQL, security-sensitive code), but must pause for human review of the diff before treating the change as approved. |
| **L3** | Explicit approval | No writes to hosted infra, no migration apply, no deploy, no destructive/sensitive unlock ops, no Docker start, until the human approves the **exact** action and target. |

### Default levels by concern

| Concern | Level |
|---------|-------|
| Docs, rules, agent defs | L1 |
| Local app scaffolding / feature code | L1 **only after** that phase is authorized (e.g. Phase 1) |
| Schema / design docs; draft migration SQL in git | L1 |
| Human review of auth/RLS migration diffs | L2 |
| **Applying** Supabase migrations (DEV or PROD) | **L3** (always) |
| MCP tool exposure of sensitive modules | L3 |
| Destructive data ops / full export | L3 |
| Deploy (Vercel / MCP host) | L3 — **not** part of Phase 1 |
| Starting Docker / local Supabase stack | L3 |
| Integrating with XNINE execution infra | Forbidden |

**Consistency note:** Early drafts implied “L2 before applying migrations.” The
binding rule is: drafting/review can be L1/L2; **apply = L3**. See
`docs/SECURITY.md` and `docs/ROADMAP.md`.

## Roles

### Lead Architect (active for Phase 0 / 0.1)

- Owns structure, stack decisions, docs, Cursor org, and phase gates.
- Records decisions in `docs/DECISIONS.md`.
- Does **not** implement full product features or scaffold the app in 0 / 0.1.
- Escalates unresolved items (R00x) to the human.

### Frontend Engineer

- Next.js App Router UI, Tailwind + shadcn/ui, charts (Recharts), a11y.
- User-scoped Supabase clients only in the browser.

### Backend Engineer

- Server actions, route handlers, domain services; Zod at boundaries.
- Holds service role only in server process env — never returns it to clients/agents.

### Database Engineer

- Conceptual + migration SQL under `supabase/migrations/`.
- Composite FKs, RLS, chapter/module constraints.
- Never applies hosted migrations without L3 to a **named DEV/PROD** project.

### MCP Engineer

- In-repo `mcp/` package; server-side AuthZ; no raw SQL / unrestricted query tools.
- Must not wire XNINE ops MCP into Personal OS.

### QA / Security Engineer

- Vitest + Playwright strategy; RLS/MCP threat review; secrets hygiene.

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
  is enabled).
- **Shared truth:** `docs/*`, `AGENTS.md`, `.cursor/rules/*`.
- **Conflicts:** security and data-ownership rules win over convenience.

## Escalation

Escalate to the human when:

1. A decision is unresolved (`docs/DECISIONS.md` R00x) or a provisional default
   should be overridden.
2. Work would require L2/L3 approval.
3. Existing meaningful code or data would be overwritten.
4. Any XNINE credential or infra appears in scope.
5. The Supabase target project is unknown or not the approved DEV project.
6. A check/command fails and blocks a success claim.

## Cursor layout

| Path | Purpose |
|------|---------|
| `AGENTS.md` | This file — roles & autonomy |
| `.cursor/rules/` | Persistent rules |
| `.cursor/agents/` | Role definitions (spawn only when authorized) |
| `.cursor/commands/` | Slash-command prompts |

## Current phase

**Phase 1B — code + migration drafts.** Target `personal-os-dev`
(`qyysmgwdvhftbgwhpbjt`, `eu-central-1`). **Do not apply migrations** until
separate explicit L3 approval (`docs/PHASE_1B_L3_STOP.md`). No Docker, no
service-role for routine ops, no silent Auth setting changes.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
