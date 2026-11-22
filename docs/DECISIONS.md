# Personal OS — Decisions

Format: **Decision** → context → choice → consequences. Unresolved items stay at
the bottom until the human decides.

## Accepted decisions

### D001 — Greenfield foundation, adapt don’t overwrite

- **Context:** Repo contained only README stub, `.gitignore`, and Supabase CLI
  init (`config.toml`, Postgres 17). No app code.
- **Choice:** Create docs/structure around existing Supabase folder; do not
  delete `supabase/config.toml` or rewrite git history.
- **Consequences:** `project_id` remains `personal-os-1` until human renames.

### D002 — Modular monolith; reject premature distributed infra

- **Context:** Proposal included microservices-class options by implication.
- **Choice:** Single Next.js modular monolith + separate MCP process only.
  No K8s, no Redis, no service mesh in near-term roadmap.
- **Consequences:** Module boundaries live under `src/modules/*`.

### D003 — Accept proposed web/data/test stack

- **Context:** Next.js/TS, Tailwind+shadcn, Recharts, Supabase, Zod,
  Vitest+Playwright, Vercel, GitHub.
- **Choice:** Accept for Phase 1 scaffold, with UX caution on generic
  dashboards and bundle weight for Recharts.
- **Consequences:** Phase 1 scaffolding follows this stack unless human
  overrides before Phase 1 starts.

### D004 — Dedicated Personal OS MCP, separate host

- **Context:** Need agent tooling without conflating with XNINE ops.
- **Choice:** Separate MCP SDK server and host; not embedded as unchecked
  admin in the web app; not XNINE MCP.
- **Consequences:** Implementation deferred to Phase 4; spec in `MCP_SPEC.md`.

### D005 — Hosted Supabase for future DB work; Docker stays off

- **Context:** Docker is stopped; local stack must not be started now.
- **Choice:** Document schema only in Phase 0; future migrations target hosted
  Personal OS Supabase under L3 approval. No XNINE DB reuse.
- **Consequences:** Dev UX for DB may be slower until Docker policy revisited.

### D006 — Sensitive data default-deny for AI

- **Context:** Behavioural and financial detail must not leak into agents.
- **Choice:** `ai_accessible` default false; MCP sensitive tools need
  confirmation + audit.
- **Consequences:** Convenience features that summarize private text need
  explicit unlocks.

### D007 — Habit statuses are five-way and Recovery is explicit

- **Context:** Binary done/not-done lies.
- **Choice:** `completed` | `partial` | `missed` | `not_scheduled` | `recovery`
  with min vs target semantics.
- **Consequences:** Streak and adherence logic must respect `not_scheduled` and
  must not silently rewrite misses as completed.

### D008 — Projects ≠ milestones ≠ tasks

- **Context:** Collapsing concepts breaks planning clarity.
- **Choice:** Three tables/entities with optional FKs.
- **Consequences:** UI and MCP tools expose them separately.

### D009 — Finance semantic split

- **Context:** Trading PnL confused with cash; revenue confused with profit.
- **Choice:** `finance_transactions` vs `trading_pnl_entries`; income categories
  include employment/freelance/business; revenue/cost fields when needed;
  multi-currency via account + explicit currency.
- **Consequences:** Reporting must label series correctly.

### D010 — XNINE module is tracking-only

- **Context:** User has XNINE systems elsewhere.
- **Choice:** Personal OS stores status/notes only; no execution integration;
  no shared credentials.
- **Consequences:** Agents must refuse XNINE infra wiring requests in this repo.

### D011 — Phase 0 does not scaffold the full Next.js app

- **Context:** Mission says establish foundation and stop for review; do not
  implement the full app.
- **Choice:** Placeholders for `src/`, `tests/`, `supabase/migrations/` only.
- **Consequences:** Phase 1 starts with official scaffold under human OK.

### D012 — No PR required for foundation unless human wants it

- **Context:** Prefer human review of files; avoid drive-by PR process noise.
- **Choice:** Leave changes on a review branch / working tree for human; do not
  treat forge PR as mandatory for Phase 0.
- **Consequences:** Coordinator/human decides when to merge.

---

## Unresolved decisions (need human)

| ID | Question | Notes / options |
|----|----------|-----------------|
| U001 | Hosted Supabase project ref & region for Personal OS | Not verified from this environment; CLI not globally installed |
| U002 | Auth providers for v0 | Email magic link only vs Google/GitHub OAuth vs both |
| U003 | Single-user lockdown vs multi-user from day one | RLS supports multi-user; product may stay single-user |
| U004 | Monorepo package for MCP (`mcp/` in-repo) vs separate repo | Lean to in-repo `mcp/` folder |
| U005 | MCP host vendor | Fly.io / Railway / Cloudflare Workers / other |
| U006 | When to allow Docker local Supabase | Stay hosted-only vs optional local later |
| U007 | Rename Supabase `project_id` (`personal-os-1` → `personal-os`) | Cosmetic |
| U008 | Base currency & primary timezone defaults | Profile fields exist conceptually |
| U009 | Check-in questionnaire v1 fields | Mood scales, prompts TBD |
| U010 | Export format priority | JSON dump vs CSV zip vs both |
| U011 | Whether Phase 1 includes Vercel deploy | Optional in roadmap |
| U012 | Recharts vs lighter charts if performance bites | Recharts accepted for v0 |

---

## Inspection notes (commands)

| Check | Result |
|-------|--------|
| `git status` | Clean on `main` before foundation edits |
| `package.json` | Missing (expected) |
| Global `supabase` CLI | **Not on PATH** |
| `npx supabase --version` | `3.2.0` |
| `node` / `npx` | `v24.22.1` / `11.21.0` |
| Docker / `supabase status` | Not run / not started (constrained) |
| `.env` files | None present |
| Hosted project link | **Unknown** — not verified |
