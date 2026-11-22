# Personal OS — Architecture

## What already exists (inspection, 2026-11-22)

| Item | Status |
|------|--------|
| GitHub repo `Matyex11/personal-os` | Present; `main` clean at inspect time |
| `README.md` | Stub (`# personal-os`) |
| `.gitignore` | Node/Next/env/Vercel-aware |
| `package.json` / app code | **Absent** — greenfield |
| Supabase CLI config | `supabase/config.toml` present (`project_id = "personal-os-1"`, Postgres **17**) |
| `supabase/migrations/` | Empty (created in foundation); **no applied migrations** |
| `.env` / credentials | None in repo; `.env*` gitignored |
| Docker / local Supabase | Not running; **must not be started** in foundation |
| Hosted Supabase link | Not verified from this machine (`supabase` CLI not on PATH; `npx supabase` works). Treat hosted project as future L3 work only |
| XNINE infra | Must not be reused |

## Stack decision (accepted with notes)

| Layer | Proposal | Verdict |
|-------|----------|---------|
| Web app | Next.js + TypeScript (App Router) | **Accept** — fits modular monolith + Vercel |
| UI | Tailwind CSS + shadcn/ui | **Accept** — fast, consistent; keep design intentional (see project frontend rules) |
| Charts | Recharts | **Accept** for v0; revisit if bundle weight hurts Core Web Vitals |
| Architecture style | Modular monolith | **Accept** — required; reject premature microservices/K8s/Redis |
| Data | Supabase Postgres | **Accept** — hosted for future work; local Docker optional later (L3) |
| Auth / Storage | Supabase Auth + Storage | **Accept** |
| Validation | Zod | **Accept** — all external boundaries |
| Unit / integration tests | Vitest | **Accept** |
| E2E | Playwright | **Accept** |
| Agent tooling | Dedicated Personal OS MCP SDK server | **Accept** — separate from web deploy |
| Web hosting | Vercel | **Accept** |
| MCP hosting | Separate host from Vercel web app | **Accept** — isolation + independent scaling/secrets |
| Source | GitHub | **Accept** |

### Challenges / constraints (not rejections)

1. **No local DB in foundation.** Docker stays stopped. Schema is documented only;
   migrations are authored later under human L3 approval against **hosted**
   Personal OS Supabase—not XNINE.
2. **MCP is not “another microservice domain.”** It is a thin, audited tool
   façade over the same modular monolith APIs/DB policies—not a second business
   logic island.
3. **Avoid Redis/queues** until a measured need (e.g., heavy async exports).
4. **shadcn + Recharts** must not dictate a generic dashboard-first UX for
   reflective surfaces; product UI follows Personal OS principles.

## High-level shape

```
┌─────────────────────────────────────────────┐
│ Next.js modular monolith (Vercel)           │
│  app/ (routes) · modules/* · lib/*          │
│  Zod boundaries · Supabase user client      │
└─────────────────┬───────────────────────────┘
                  │ service role only on server
                  ▼
┌─────────────────────────────────────────────┐
│ Supabase (hosted Personal OS project)       │
│  Postgres + RLS · Auth · Storage            │
└─────────────────┬───────────────────────────┘
                  ▲
                  │ audited tool calls (scoped)
┌─────────────────┴───────────────────────────┐
│ Personal OS MCP server (separate host)      │
│  read / write / admin tools · confirmations │
└─────────────────────────────────────────────┘
```

## Modular monolith layout (target)

```
src/
  app/                 # Next.js App Router
  modules/
    chapters/
    habits/
    tasks/
    projects/
    milestones/
    checkins/
    finances/
    physical/
    behavioural/       # sensitive — extra gates
    reviews/
    xnine-tracking/    # tracking-only
  lib/
    db/                # Supabase clients, RLS-aware helpers
    auth/
    validation/        # shared Zod
    audit/
  components/          # shared UI
mcp/                   # MCP server package (separate deployable)
supabase/migrations/   # SQL only; apply with L3 approval
tests/
  unit/
  e2e/
```

Foundation creates placeholder `src/`, `supabase/migrations/`, and `tests/`
directories only—**no full Next.js scaffold yet** (phase gate).

## Testing strategy (initial)

| Layer | Tool | Focus |
|-------|------|-------|
| Unit / pure domain | Vitest | Status math (habits min/target), finance classifiers, Zod schemas |
| Component | Vitest + Testing Library (optional early) | Critical form states |
| E2E | Playwright | Auth smoke, habit log, project+milestone create, RLS denial cases via UI |
| DB | SQL tests / later pgTAP or policy tests | RLS ownership; run only when a DB is available under approval |
| MCP | Contract tests | Permission matrix, sensitive module denial, audit events |

CI should run Vitest on every PR; Playwright on main/PRs once the app boots.
No test runner is installed in the foundation phase.

## Deployment topology

- **Web:** Vercel ↔ hosted Supabase (URL + anon key public; service role server-only).
- **MCP:** Separate Node host; its own secrets; never embed service role in the
  browser or in Cursor chat logs.
- **Never** point Personal OS at XNINE databases or ops MCP servers.

## Open architecture items

See `docs/DECISIONS.md` unresolved list (exact MCP host, monorepo vs `mcp/`
folder, email vs OAuth-only, etc.).
