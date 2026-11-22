# Personal OS — Roadmap

## Autonomy vs phases (consistency with AGENTS.md)

| Phase work | Autonomy |
|------------|----------|
| Docs / rules / design SQL in git | L1 |
| App feature code after phase is authorized | L1 within that phase’s scope |
| Apply migrations to DEV or PROD | **Always L3** (named project) |
| Start Docker | **L3** (default: don’t) |
| Deploy Vercel / MCP host | **L3** — **not** in Phase 1 |
| Spawn sibling role agents | Only when a phase explicitly authorizes |

Drafting risky SQL/auth changes may be **L2 supervised** (human reviews the
diff); **executing** against hosted infra remains **L3**.

---

## Phase 0 — Foundation

**Goal:** Structure, Cursor org, documentation. No scaffold, migrate, deploy, or Docker.

**Status:** Complete (see foundation branch). Human review requested.

---

## Phase 0.1 — Architecture review

**Status:** Accepted. Provisional decisions D013–D024 stand unless human overrides.

---

## Phase 1B — DEV wiring + migration drafts *(in progress — L3 apply gated)*

**Authorized:** local app code, Supabase SSR auth, domain services/UI, tests,
timestamped migration **drafts** against recorded target `personal-os-dev`
(`qyysmgwdvhftbgwhpbjt`, `eu-central-1`).

**Forbidden until separate L3:** `db push`, migration up, hosted schema mutation,
Docker, Auth setting changes without human review checklist.

See `docs/AUTH_DEV_SETUP.md` and `docs/PHASE_1B_L3_STOP.md`.

---

## Phase 1A — Local application foundation *(complete)*

**Goal:** Scaffold the modular monolith locally with shell UI and test tooling.
**No** DB integration, migrations, Supabase connect, Docker, deploy, or agent spawn.

Delivered:

1. Next.js 16 App Router + TypeScript strict + Tailwind 4 + shadcn-style UI + Zod
2. Vitest 3 + Playwright configs and initial tests
3. Routes: Dashboard, Chapters, Habits, Projects, Settings (placeholders)
4. Domain modules (schemas + habit reporting helpers) without persistence
5. Auth session placeholder; `.env.example` with Supabase vars commented

**Exit criteria:** Typecheck, unit tests, e2e navigation, and production build
pass locally → human review → authorize **Phase 1B**.

---

## Phase 1B — DEV Supabase + vertical slice *(next after human OK)*

**Goal:** Wire the local app to a **named Personal OS EU DEV** Supabase project
(no XNINE, no PROD, no Vercel).

In scope:

1. Human provides concrete DEV project ref; wire `.env.local` (never commit secrets).
2. Author **first migration(s)** for: `profiles`, `chapters`, `module_activations`
   (global/chapter scope), `habits`, `habit_logs` (recovery link model),
   `projects`, `milestones`, `tasks`, `audit_logs` (+ RLS + composite FKs).
   **Apply only after L3** naming the DEV project.
3. Auth: **email magic link** (D014).
4. Minimal UI: current chapter, module toggles, habit log (all statuses +
   recovery as linked event), project → milestone → task.
5. Expand Vitest/Playwright for auth + habit persistence smoke.
6. Defaults: timezone `Europe/Bucharest`, base currency `RON` (profile).

**Explicitly out of Phase 1B:**

- **Vercel deploy** (D023)
- Finances / behavioural / physical UI
- MCP server implementation
- Docker-required workflows
- Check-ins / reviews (Phase 2)
- XNINE execution integration
- Microservices / Redis / K8s
- PROD migrations

**Exit criteria:** Local app signs in against DEV (once approved), activates
modules, logs habits correctly (miss preserved + recovery linked), manages a
simple project tree; CI unit tests run; migrations applied only with L3.

---

## Phase 2 — Check-ins, reviews, physical

- Simple check-ins (`mood` / `energy` / `focus` + optional note)
- Weekly review surfaces
- Physical metrics + simple Recharts
- Expand RLS/Playwright coverage on DEV

## Phase 3 — Finances (careful semantics)

- Accounts; typed transactions; transfers; trading PnL separate
- Multi-currency display toward RON base
- Employment / freelance / business income; business revenue vs cost
- Sensitive-by-default + export draft (JSON + CSV)

## Phase 4 — Behavioural + MCP

- Behavioural records (`ai_accessible` default false)
- In-repo `mcp/` server with AuthZ, no raw SQL, confirmations, audit
- MCP **host** deploy only after vendor choice (R003) + L3

## Phase 5 — Hardening & portability

- Full JSON + CSV export/import
- Security pass; performance pass
- Optional Docker local Supabase (still L3 to start)
- PROD cutover only with explicit L3

## Testing strategy across phases

| Phase | Vitest | Playwright | Other |
|-------|--------|------------|-------|
| 0 / 0.1 | Document only | Document only | |
| 1A | Habit + recovery rules, Zod, UI | Shell navigation | ✅ executed |
| 1B | Persistence helpers | Auth + habit smoke (DEV) | |
| 2–3 | Domain math / finance classifiers | Core journeys | RLS on DEV |
| 4 | MCP permission matrix | Confirmation flows | Audit assertions |

## Stop points

Human review after Phase 0 and **0.1**, and before any hosted migration or
deploy in later phases.
