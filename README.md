# Personal OS

Private, modular life-operating system. Answers three questions: **Where am I?**,
**What matters now?**, and **How did I actually do?**

## Status

**Phase 1A — Local application foundation** (complete on this branch). Next.js
shell, design system, domain Zod/types, Vitest + Playwright. **No** database,
Supabase connection, migrations, Docker, or deploy.

Awaiting human review before **Phase 1B** (named EU DEV Supabase + auth +
persistence).

## Requirements

- **Node.js >= 20.9** (Next.js 16). On this machine, prefer
  `C:\Program Files\nodejs` over any agent-bundled Node 18 on PATH.

## Scripts

```bash
npm run dev          # local app at http://127.0.0.1:3000
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright (starts Next via process.execPath)
npm run lint         # ESLint
```

## Stack (installed)

| Package | Role |
|---------|------|
| `next@16.4.6` | App Router |
| `react@19.3` / `react-dom@19.3` | UI |
| `typescript` (strict) | Types |
| `tailwindcss@4.3` + `@tailwindcss/turbopack` | Styling |
| `zod@4` | Validation |
| shadcn-style primitives (`button`, `input`, `label`, `card`, `separator`) | UI kit |
| `vitest@3` + Testing Library | Unit tests |
| `@playwright/test` | E2E |

## App structure

```
src/
  app/                 # routes: /, /chapters, /habits, /projects, /settings
  components/          # layout, ui, forms, states
  modules/             # chapters, habits, projects (schemas + pure domain)
  lib/                 # utils, errors, auth placeholder, validation
  types/               # shared domain types
tests/unit|e2e
docs/                  # product & architecture docs
supabase/              # CLI config only — no applied migrations
```

## Docs

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](./AGENTS.md) | Roles, autonomy (L1/L2/L3) |
| [docs/PRODUCT_SPEC.md](./docs/PRODUCT_SPEC.md) | Mission, modules |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Stack & layout |
| [docs/DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | Conceptual schema |
| [docs/MCP_SPEC.md](./docs/MCP_SPEC.md) | Personal OS MCP |
| [docs/SECURITY.md](./docs/SECURITY.md) | Security model |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Phases (1A done → 1B next) |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | Decisions |

## Hard constraints

- Do not start Docker unless L3-approved.
- Do not apply hosted Supabase migrations without L3 to a **named EU DEV** project.
- Never commit secrets; never reuse XNINE credentials or execution infra.
- XNINE module is tracking-only.
