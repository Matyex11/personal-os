# Personal OS — Decisions

Format: **Decision** → context → choice → consequences. Unresolved items stay at
the bottom until the human decides.

## Accepted decisions

### D001 — Greenfield foundation, adapt don’t overwrite

- **Context:** Repo contained only README stub, `.gitignore`, and Supabase CLI
  init (`config.toml`, Postgres 17). No app code.
- **Choice:** Create docs/structure around existing Supabase folder; do not
  delete `supabase/config.toml` or rewrite git history.
- **Consequences:** CLI `project_id` remains `personal-os-1` until human renames
  (see R001).

### D002 — Modular monolith; reject premature distributed infra

- **Choice:** Single Next.js modular monolith + separate MCP process only.
  No K8s, no Redis, no service mesh in near-term roadmap.

### D003 — Accept proposed web/data/test stack

- **Choice:** Next.js/TS, Tailwind+shadcn, Recharts, Supabase, Zod,
  Vitest+Playwright, GitHub for Phase 1+. Vercel accepted as eventual host but
  **not** deployed in Phase 1 (D023).

### D004 — Dedicated Personal OS MCP, separate process

- **Choice:** Separate MCP SDK server from the web app; not XNINE MCP.
- **Update (0.1):** Package lives **in-repo** (`mcp/`, D016); host vendor deferred (D017).

### D005 — Environment separation; Docker stays off

- **Context:** Docker is stopped; hosted linkage unverified; risk of mutating the
  wrong project.
- **Choice (0.1 correction):** Require a **dedicated EU development** Supabase
  project before real schema experimentation. Do **not** assume any existing
  hosted project is linked or safe. Production is a **separate** project.
  Docker remains optional and **stopped** (D018). No XNINE DB reuse.
- **Consequences:** Phase 1 DB work targets named DEV only after L3.

### D006 — Sensitive data default-deny for AI

- **Choice:** `ai_accessible` default false; MCP sensitive tools need
  confirmation + audit; server-side AuthZ mandatory (see MCP_SPEC).

### D007 — Habit statuses five-way; recovery is a linked event

- **Choice:** `completed` \| `partial` \| `missed` \| `not_scheduled` \| `recovery`.
- **Update (0.1):** Original `missed` (primary) logs are **permanent**. Recovery
  is a **separate** row with `recovers_log_id`; it must not rewrite historical
  adherence. Reporting rules live in `DATABASE_SCHEMA.md`.

### D025 — Habit adherence dual metrics (resolves R005)

- **Context:** Numeric “partial credit” (e.g. 0.5) was provisional and ambiguous.
- **Choice:** Two rates over **expected scheduled occurrences**:
  - Target attainment = `completed / scheduledOccurrences`
  - Minimum adherence = `(completed + partial) / scheduledOccurrences`
  - `missed` and **unlogged** scheduled days → 0 on both numerators, still in
    the denominator
  - `not_scheduled` and `recovery` excluded from the denominator
  - Recovery never alters historical adherence; no backfill / mutation of old
    rows; unlogged scheduled dates must be surfaced explicitly
- **Consequences:** Removed `partialCredit` / `PROVISIONAL_PARTIAL_CREDIT` from
  reporting code. UI should present both rates. **R005 resolved.**

### D008 — Projects ≠ milestones ≠ tasks

- **Choice:** Three entities with optional same-user FKs (composite where practical).

### D009 — Finance semantic split (strengthened 0.1)

- **Choice:** Typed `finance_transactions` kinds separate cash movements
  (`deposit`/`withdrawal`/`transfer`), personal `income`/`expense`,
  `business_revenue`/`business_cost`, and fees from **`trading_pnl_entries`**.
  Profit is never derived by summing generic mixed transactions. Transfers are
  paired, net-zero cash moves. Multi-currency via account currency + base **RON**.

### D010 — XNINE module is tracking-only

- **Choice:** Status/notes only; no execution integration; no shared credentials.

### D011 — Phase 0 does not scaffold the full Next.js app

- **Choice:** Placeholders only until Phase 1 is explicitly authorized.

### D012 — No PR required for foundation unless human wants it

- **Choice:** Prefer human review; commit on foundation branch is OK.

---

## Phase 0.1 product defaults (provisional until human confirms)

These resolve prior U00x items. Marked **provisional** — human may override
before Phase 1 without treating it as an emergency.

### D013 — Single-user v0; user-scoped architecture *(provisional)*

- **Choice:** Product focus is one primary user; every row still has `user_id` +
  RLS (multi-user-safe schema, single-user product).
- Resolves **U003**.

### D014 — Email/password auth for v0 *(provisional; updated)*

- **Original choice:** Supabase email magic link only for v0; OAuth later if needed.
- **Update (Phase 1B):** **Email/password primary** (`signInWithPassword`);
  magic link / OTP remains a **fallback** (`signInWithOtp` with
  `shouldCreateUser: false`). No public signup; no public recovery UI; password
  set/change in Settings (≥ 12 chars); manual recovery via trusted Supabase Auth
  admin only. See `docs/AUTH_DEV_SETUP.md`.
- Resolves **U002**.

### D015 — Dedicated EU development Supabase project *(provisional; updated)*

- **Choice:** Provision/use a dedicated **EU** Personal OS **DEV** project before
  schema experiments. PROD is separate and later.
- **Update (Phase 1B acceptance, 2026-11-24):** DEV is **personal-os-dev**
  (`qyysmgwdvhftbgwhpbjt`, `eu-central-1`). PROD ref remains separate and must
  not be targeted casually (see R002).
- Resolves **U001** for DEV; PROD naming still tracked under R002.

### D016 — MCP as in-repository package *(provisional)*

- **Choice:** `mcp/` directory in this repo (separate deployable), not a second
  git repo for v0.
- Resolves **U004**.

### D017 — Defer MCP hosting selection *(provisional)*

- **Choice:** Decide Fly / Railway / Cloudflare / other when Phase 4 nears.
- Keeps **U005** open as R003.

### D018 — Docker remains optional and stopped *(provisional)*

- **Choice:** Do not start Docker in Phase 0/0.1/1 by default; L3 if ever needed.
- Resolves **U006**.

### D019 — Default timezone `Europe/Bucharest` *(provisional)*

- **Choice:** Profile default IANA TZ `Europe/Bucharest`.
- Resolves timezone part of **U008**.

### D020 — Base currency RON with multi-currency support *(provisional)*

- **Choice:** `profiles.base_currency = RON`; accounts may use other ISO
  currencies; reporting converts explicitly later.
- Resolves currency part of **U008**.

### D021 — Simple initial check-in fields *(provisional)*

- **Choice:** v1 = `mood`, `energy`, `focus` (1–5) + optional short `body`;
  `prompt_set_key = v1_simple`.
- Resolves **U009**.

### D022 — Export JSON and CSV *(provisional)*

- **Choice:** Both formats in the portability/export flow.
- Resolves **U010**.

### D023 — No Vercel deployment in Phase 1 *(provisional)*

- **Choice:** Phase 1 is local scaffold + DEV DB work only; Vercel is L3 in a
  later phase.
- Resolves **U011**.

### D024 — Composite FKs + explicit module activation scope *(provisional)*

- **Choice:** Prefer `(user_id, parent_id)` FKs; `module_activations.scope`
  `global`\|`chapter` with partial unique indexes (nullable-safe).
- **Correction:** Replaces naive `UNIQUE (user_id, chapter_id, module_key)`.

---

## Remaining unresolved / risks

| ID | Question | Notes |
|----|----------|-------|
| R001 | Rename CLI `project_id` (`personal-os-1` → `personal-os`) | Cosmetic (ex-U007) |
| R002 | Concrete Supabase **PROD** project ref (DEV resolved) | **DEV resolved:** `personal-os-dev` / `qyysmgwdvhftbgwhpbjt` / `eu-central-1`. Documented PROD forbid: `bdmhlzbigdedqsqirwxn` — confirm when PROD cutover nears; do not invent or scrape |
| R003 | MCP host vendor | Deferred (D017 / ex-U005) |
| R004 | FX policy for cross-currency transfers | Rates source, mid-market vs booked rate |
| R006 | Recharts vs lighter charts if performance bites | Ex-U012; D003 still names Recharts. Phase 2 physical shipped **text recent series** only (no chart dependency added). Revisit when a chart is justified. |
| R007 | Whether PROD may ever be same org different project only | Assumed separate projects |

---

## Inspection notes (commands)

### Phase 0 snapshot (2026-11-22) — historical

| Check | Result (then) |
|-------|----------------|
| `git status` | Clean on `main` before Phase 0; foundation work on `cursor/personal-os-foundation-67da` |
| `package.json` | Missing (expected at Phase 0) |
| Global `supabase` CLI | **Not on PATH** |
| `npx supabase --version` | `3.2.0` |
| `node` / `npx` | `v24.22.1` / `11.21.0` |
| Docker / `supabase status` | Not started (constrained) |
| `.env` files | None present |
| Hosted project link | **Unknown / unsafe to assume** |

### Current state note (Phase 2 M4 hardening, 2026-11-25)

| Check | Result |
|-------|--------|
| App / `package.json` | Present — Next.js 16 vertical slice on branch |
| Migrations | `20261122190000` + Phase 2 `20261124190000` applied on **personal-os-dev** (L3) |
| DEV ref | `qyysmgwdvhftbgwhpbjt` (`eu-central-1`) |
| Docker | Still stopped (L3 to start) |
| Secrets | `.env.example` only in git; `.env.local` local-only |
| Phase status | Phase 1B **accepted**; Phase 2 **implemented** (check-ins / reviews / physical) — **M4 pending acceptance** |
