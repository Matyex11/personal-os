# Personal OS — Roadmap

## Phase 0 — Foundation (current)

**Goal:** Inspect repo, establish structure, Cursor agent org, and documentation.
Stop for **human review** before any feature implementation.

Deliverables:

- Repo structure (`docs/`, `.cursor/`, `src/`, `supabase/migrations/`, `tests/`)
- `AGENTS.md`, rules, agent definitions, commands
- Product / architecture / schema / MCP / security / decisions docs
- No Docker, no hosted migrations, no deploy, no full app scaffold

**Exit criteria:** Human approves docs and unresolved decisions (or explicitly
defers them); authorizes Phase 1.

---

## Phase 1 — First implementation build (explicit next phase)

**Goal:** Vertical slice of the modular monolith on **hosted Personal OS
Supabase** (no XNINE), still without unnecessary infra.

In scope:

1. Scaffold Next.js + TypeScript + Tailwind + shadcn + Zod + Vitest + Playwright
   in-repo (adapt if Phase 0 review changes stack).
2. Wire env via `.env.example` + local secrets (never commit).
3. Author **first migration(s)** for: `profiles`, `chapters`,
   `module_activations`, `habits`, `habit_logs`, `projects`, `milestones`,
   `tasks`, `audit_logs` (+ RLS). Apply only after L3 human approval.
4. Auth (email magic link and/or OAuth — decision in DECISIONS).
5. Minimal UI: current chapter, module toggles, habit log with full status enum,
   project → milestone → task create/list.
6. Vitest for habit status rules; Playwright smoke for auth + habit log.
7. Deploy web to Vercel only if human L3-approves (optional within Phase 1).

Out of scope for Phase 1:

- Full finances / behavioural / physical modules UI
- MCP server implementation
- Docker-required workflows
- XNINE execution integration
- Microservices / Redis / K8s

**Exit criteria:** User can sign in, activate modules, log habits correctly,
manage a simple project tree; CI runs unit tests; migrations applied only with
approval.

---

## Phase 2 — Check-ins, reviews, physical

- Check-in flows and weekly review surfaces
- Physical metrics logging + simple Recharts
- Expand RLS tests and Playwright coverage

## Phase 3 — Finances (careful semantics)

- Accounts, transactions, trading PnL as separate concepts
- Multi-currency display; employment / freelance / business income categories
- Sensitive-by-default + export draft

## Phase 4 — Behavioural + MCP

- Behavioural records with `ai_accessible` default false
- Personal OS MCP server (read/write/admin + confirmations + audit)
- Separate MCP host deploy (L3)

## Phase 5 — Hardening & portability

- Full export/import
- Security pass (QA/Security agent authorized)
- Performance pass on charts/queries
- Decide on local Docker Supabase for offline dev (optional)

## Testing strategy across phases

| Phase | Vitest | Playwright | Other |
|-------|--------|------------|-------|
| 0 | Document only | Document only | |
| 1 | Habit rules, Zod | Auth + habit smoke | |
| 2–3 | Domain math | Core journeys | RLS checks when DB available |
| 4 | MCP permission matrix | Confirmation flows | Audit assertions |

## Stop points

Human review is mandatory after Phase 0 and before any hosted migration or
deploy in later phases.
