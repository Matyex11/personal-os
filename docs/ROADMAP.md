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
Auth for v0 is **email/password primary** with magic-link fallback (D014 updated;
see `docs/DECISIONS.md` and `docs/AUTH_DEV_SETUP.md`).

---

## Phase 1B — DEV schema + app vertical slice *(Complete — Accepted with explicit limitations)*

**DEV target:** `personal-os-dev` (`qyysmgwdvhftbgwhpbjt`, `eu-central-1`).
**Schema:** migration `20261122190000` applied on DEV; SQL integrity scripts passed (human).
**App:** SSR auth + domain services + usable vertical-slice UI. App-layer plan
items **P0.1–P0.4**, **P1.1–P1.2**, **P2.1–P2.4** are **Done**.
**Human acceptance:** **2026-11-24** — **ACCEPT WITH EXPLICIT LIMITATIONS**
(Project store report
`docs/phase-1b-final-acceptance.md`; closure note
`docs/phase-1b-acceptance-closure.md`). **Phase 2 is authorized to begin.**

**Still forbidden without L3:** further hosted schema apply, Docker, deploy, PROD,
Auth setting changes without checklist, service-role to agents.

See `docs/AUTH_DEV_SETUP.md` for operator Auth + Playwright ops. Historical L3 apply
notes live in `docs/PHASE_1B_L3_STOP.md` (status banner updated; body kept as apply record).
App-layer audit/plan lives in the Project agent store (not this git tree):
`phase-1b-app-layer-plan.md`.

### App-layer progress (1B-App)

| Item | Status |
|------|--------|
| P0.1 Habit logging / recovery UX | **Done** |
| P0.2 Habit reporting (selected habit + range) | **Done** |
| P0.3 Chapter make-current + lifecycle clarity | **Done** |
| P0.4 Project / milestone / task status updates | **Done** |
| P1.1 Actionable dashboard (“now”) | **Done** |
| P1.2 Soft module gating | **Done** |
| P2.1 Profile edit (display name, timezone, currency) | **Done** |
| P2.2 Chapter-scoped module overrides UI | **Done** |
| P2.3 Authenticated Playwright vertical slice | **Done** (commit `51a4a03`) |
| P2.4 Docs / roadmap reconciliation | **Done** (commit `6af7d7f`) |
| Phase 1B final acceptance review | **Accepted 2026-11-24** (with explicit limitations) |

### Accepted explicit limitations (do not silently resolve)

These remain **accepted constraints** from the 2026-11-24 final acceptance review.
They are not product blockers and were not “fixed” by this closure docs pass.

**Testing / verification gaps**

- Live password-login success + wrong-password Playwright cases were **skipped** when shell `E2E_USER_*` unset.
- Authenticated Playwright used live gitignored `storageState` via `--no-deps` (not a fresh auth-preflight).
- Password-setting e2e covers client mismatch only — **no** live `updateUser` password mutation.
- SQL integrity scripts 01–04: **historical** human PASS on DEV — not re-executed at final acceptance.
- Hosted Auth dashboard checklist (`docs/AUTH_DEV_SETUP.md`): **UNVERIFIED** at acceptance (app-layer safeguards PASS).

**Product / security posture limitations**

- Residual DEV `e2e-p23-…` chapters, overrides, habits/logs, project trees (app has no DELETE).
- Module override cannot reset-to-inherit (no client DELETE of activation rows).
- Chapter make-current is multi-statement; partial unique index is the concurrency backstop.
- `habit_logs` retains authenticated UPDATE privilege; immutability relies on triggers (historically tested).
- Trusted audit writer still deferred; clients SELECT-own audit only.
- `next-env.d.ts` local generated path drift is expected noise (do not commit as cleanup).
- Prior-to-isolation global Enable history may not match an unknown operator baseline.
- Further schema apply / Docker / deploy / PROD remain **L3**.

**Operator comfort (human; optional)**

- Confirm Auth checklist against live DEV dashboard.
- Optional: re-run credential-gated password-login with shell `E2E_USER_*`.
- Optional privileged cleanup of e2e leftovers.

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

## Phase 1B — DEV Supabase + vertical slice *(scope & criteria)*

**Goal:** Wire the local app to a **named Personal OS EU DEV** Supabase project
(no XNINE, no PROD, no Vercel) and finish a coherent usable product slice.

In scope (implemented unless noted):

1. Human provides concrete DEV project ref; wire `.env.local` (never commit secrets).
2. Author **first migration(s)** for: `profiles`, `chapters`, `module_activations`
   (global/chapter scope), `habits`, `habit_logs` (recovery link model),
   `projects`, `milestones`, `tasks`, `audit_logs` (+ RLS + composite FKs).
   **Applied on DEV** with L3 (`20261122190000`); further applies still L3.
3. Auth: **email/password primary**, magic-link fallback, no public signup
   (D014; see `docs/AUTH_DEV_SETUP.md`).
4. Minimal UI: current chapter, global + chapter module controls, habit log
   (all statuses + recovery as linked event), project → milestone → task with
   status updates, profile settings, actionable dashboard, soft module gating.
5. Vitest coverage for domain helpers; Playwright unauthenticated + authenticated
   vertical-slice smoke on DEV (storageState; dedicated E2E account).
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

**Exit criteria (met — accepted 2026-11-24 with explicit limitations above):**

| Criterion | Implementation status |
|-----------|------------------------|
| Local app signs in against DEV | Password primary + magic-link fallback; manual first user |
| Manage current chapter + lifecycle | Create / close / make current |
| Activate modules (global + chapter) | Global toggles + chapter override UI |
| Log habits (five statuses; miss preserved; recovery linked) | Habit picker + recovery picker; DB+app validation |
| Accurate habit reporting for selected habit/window | UI + unit-tested dual adherence |
| Manage simple project tree with status | Create + status updates for project/milestone/task |
| Profile defaults editable | Display name, timezone, currency |
| Soft module gating | Nav/sections respect resolution |
| Playwright vertical-slice smoke | Authenticated project + unauth project; see Auth doc |
| CI / local unit tests | Vitest green on domain + UI helpers |
| Migrations | Applied on DEV only with L3; no further apply without L3 |

---

## Phase 2 — Check-ins, reviews, physical *(implemented — pending M4 acceptance)*

**Status:** **Implemented on branch** `cursor/personal-os-foundation-67da`
(M1 check-ins, M2 weekly reviews, M3 physical metrics; M4 hardening). Schema migration
`20261124190000_phase2_checkins_reviews_physical.sql` was applied on **personal-os-dev**
under L3 during M0; further hosted apply remains L3.

**Delivered:**

- Check-ins: one per civil day in profile TZ; mood/energy/focus 1–5 + optional note;
  historical edit; soft `checkins` gating; dashboard today status; Playwright slice
- Weekly reviews: ISO Mon–Sun week; draft → complete → reopen; display-time summaries;
  soft `reviews` gating; dashboard week status; Playwright slice
- Physical metrics: five approved keys on `public.physical_metrics`; subset per day;
  date select + history; text recent series (**no Recharts** — none in app deps;
  R006 chart choice deferred); soft `physical` gating; dashboard latest snapshot;
  Playwright slice

**Explicit Phase 2 limitations:** no DELETE for these tables; no medical/wearable claims;
no chart library; unit tests assert ownership scoping + 23505 recovery — not a live RLS
proof from mocks; L3 gates (Docker, deploy, PROD, further schema) unchanged.

Accepted Phase 1B limitations and all L3 gates still apply.

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
| 1B | Persistence helpers + UI forms | Unauth + authenticated vertical slice (DEV) | SQL integrity on DEV (human) |
| 2–3 | Domain math / finance classifiers | Core journeys | RLS on DEV |
| 4 | MCP permission matrix | Confirmation flows | Audit assertions |

## Stop points

Human review after Phase 0 and **0.1**, after Phase **1B acceptance** (closed
2026-11-24 with explicit limitations), and before any hosted migration or deploy
in later phases.
