# Personal OS — Architecture

## What already exists (updated after Phase 1B acceptance, 2026-11-24)

| Item | Status |
|------|--------|
| GitHub repo `Matyex11/personal-os` | Present; work on `cursor/personal-os-foundation-67da` |
| `package.json` / app code | **Phase 1B vertical slice** — Next.js 16 App Router + Supabase SSR clients under `src/` |
| Supabase CLI config | `supabase/config.toml` (`project_id = "personal-os-1"`, Postgres **17**) |
| `supabase/migrations/` | `20261122190000_phase1b_core.sql` present; **applied on personal-os-dev** |
| `.env` / credentials | `.env.example` placeholders; secrets only in local `.env.local` (never commit) |
| Docker / local Supabase | **Stopped**; must not be started without L3 |
| Hosted Supabase DEV | **Named:** `personal-os-dev` (`qyysmgwdvhftbgwhpbjt`, `eu-central-1`). PROD (`bdmhlzbigdedqsqirwxn`) is separate — never default |
| XNINE infra | Must not be reused |

*Historical note:* A 2026-11-22 Phase 0 inspection recorded empty migrations and an
unverified hosted link. That snapshot is superseded by Phase 1B apply + acceptance.*

## Environment separation (dev vs production)

| Environment | Purpose | Rule |
|-------------|---------|------|
| **Local app** | Next.js / Vitest / Playwright against configured URLs | Secrets in `.env.local` only |
| **Supabase DEV (required)** | Dedicated **EU** Personal OS project for schema experiments & Phase 1+ DB work | Must exist **before** real schema experimentation; L3 to apply migrations |
| **Supabase PROD** | Real user data (later) | Separate project; never target casually; L3 only |
| **Docker local Supabase** | Optional offline DB | **Stopped**; L3 to start; not required for Phase 1 |
| **MCP host** | Separate process from web | Vendor **deferred** (D017); package lives **in-repo** under `mcp/` (D016) |

**Do not** assume the “existing” hosted project (if any) is linked to this repo or
safe to modify. Agents must not probe, migrate, or mutate hosted schemas until
the human names the DEV project and approves the exact action.

```
┌─────────────────────────────────────────────┐
│ Next.js modular monolith                    │
│  (local Phase 1; Vercel deploy deferred)    │
│  Zod · user-scoped Supabase client          │
└─────────────────┬───────────────────────────┘
                  │ service role: server process only
                  ▼
┌─────────────────────────────────────────────┐
│ Supabase DEV (EU, dedicated) ──► later PROD │
│  Postgres + RLS · Auth · Storage            │
└─────────────────┬───────────────────────────┘
                  ▲
                  │ typed, authorized, audited tools
┌─────────────────┴───────────────────────────┐
│ Personal OS MCP (in-repo `mcp/` package)    │
│  host process holds secrets; agents do not  │
└─────────────────────────────────────────────┘
```

## Stack decision (accepted with notes)

| Layer | Proposal | Verdict |
|-------|----------|---------|
| Web app | Next.js + TypeScript (App Router) | **Accept** |
| UI | Tailwind CSS + shadcn/ui | **Accept** |
| Charts | Recharts | **Accept** for v0 (U012 revisit if needed) |
| Architecture style | Modular monolith | **Accept** |
| Data | Supabase Postgres | **Accept** — **DEV project first**; PROD later |
| Auth | Supabase Auth — **email/password primary**, magic-link fallback (D014) | **Accept** |
| Validation | Zod | **Accept** |
| Tests | Vitest + Playwright | **Accept** |
| MCP | In-repo `mcp/` SDK server | **Accept**; host vendor deferred |
| Web hosting | Vercel | **Accept later** — **not in Phase 1** (D023) |
| Source | GitHub | **Accept** |

### Challenges / constraints

1. Schema work waits on a dedicated EU DEV Supabase project; Docker stays off.
2. MCP is a **thin authorized façade** over domain services — not a second
   business-logic island and **not** a SQL console.
3. No Redis/K8s/microservices in near-term roadmap.
4. Habit **recovery** is a linked event; historical `missed` rows stay permanent
   (see `DATABASE_SCHEMA.md` reporting table).
5. Finance reporting must not derive ambiguous “profit” from mixed transactions.

## Modular monolith layout (Phase 1A actual + future)

```
src/
  app/                      # /, /chapters, /habits, /projects, /settings
  components/
    layout/                 # AppShell, AppNav, PageHeader
    ui/                     # shadcn-style button, input, label, card, separator
    forms/                  # Field wrapper
    states/                 # EmptyState, LoadingState
  modules/
    chapters/schemas.ts
    habits/{schemas,reporting}.ts
    projects/schemas.ts
    # finances/behavioural/… later phases
  lib/
    utils.ts · errors.ts
    auth/session.ts         # placeholder only (1A)
    validation/common.ts
    db/ · audit/            # README stubs until 1B+
  types/domain.ts
mcp/                        # Phase 4+
supabase/migrations/        # apply only to approved DEV (then PROD) with L3
tests/unit|e2e
```

**Phase 1A:** local shell + pure domain/Zod + tests.

**Phase 1B (accepted 2026-11-24 with explicit limitations):** Supabase SSR clients
(`src/lib/supabase/*`), `src/proxy.ts` session refresh via `getClaims()`, domain
services under `src/modules/*`, data-backed vertical-slice UI, cadence v1, migration
`supabase/migrations/20261122190000_phase1b_core.sql` **applied** on
`personal-os-dev`. Publishable key only. Auth: password primary + magic-link
fallback. Further hosted schema apply remains L3. **Phase 2 authorized** (not started).
See `docs/ROADMAP.md` for accepted limitations.

## MCP boundary (consistency with MCP_SPEC)

- MCP server runs as its own process with **server-side authorization** on every tool.
- Tools are explicit, user-scoped operations — **no** unrestricted DB query tool,
  **no** raw SQL, **no** service-role disclosure to agents.
- Domain rules live in the monolith (or shared packages); MCP calls those paths.

## Testing strategy (initial)

| Layer | Tool | Focus |
|-------|------|-------|
| Unit | Vitest 3 + Testing Library | Habit reporting, Zod recovery rules, UI primitives (Phase 1A ✅) |
| E2E | Playwright | Shell navigation (1A ✅); unauth + authenticated vertical slice (1B) |
| DB | When DEV DB available | RLS + composite ownership; never start Docker without L3 |
| MCP | Phase 4 | Permission matrix, sensitive denial, audit events |

**Runtime note:** Next 16 / Playwright require Node >= 20.9. Launch tools with a
system Node binary if an agent-bundled Node 18 appears earlier on PATH.

## Defaults (provisional product decisions)

See `docs/DECISIONS.md` D013–D023: single-user v0, email/password (+ magic-link fallback), EU DEV Supabase,
in-repo MCP, Docker optional/stopped, `Europe/Bucharest`, RON + multi-currency,
simple check-ins, JSON+CSV export, no Phase 1 Vercel deploy.

## Open architecture items

DEV project ref is named (`qyysmgwdvhftbgwhpbjt` — R002 partial). Remaining:
concrete **PROD** ref confirmation, MCP host vendor, FX policy for
cross-currency transfers, cosmetic CLI `project_id` rename — see DECISIONS.
