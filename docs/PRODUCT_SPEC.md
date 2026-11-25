# Personal OS — Product Spec

## Mission

Personal OS is a private, modular life-operating system for **one primary user**
in v0 (schema remains user-scoped). It answers three recurring questions with
trustworthy data and deliberate reflection—not generic productivity noise.

## Three core questions

1. **Where am I?** — Current chapter, active modules, habits, tasks, physical and
   financial baselines, recent check-ins.
2. **What matters now?** — Prioritized projects, milestones, recovery needs, and
   commitments that deserve attention this week.
3. **How did I actually do?** — Honest review of habits (including Partial /
   Missed / Recovery **as a linked make-up, not a rewrite**), projects vs
   milestones, finances (cash ≠ income/expense ≠ business profit ≠ trading PnL),
   and behavioural patterns the user chooses to surface.

## Modules (activation: global defaults + chapter overrides)

| Module | Purpose |
|--------|---------|
| **Chapters / History** | Named life periods; explicit active/closed lifecycle |
| **Module activation** | Global defaults and per-chapter overrides |
| **Habits** | Min vs target; statuses including permanent misses + linked recovery |
| **Tasks** | Atomic actionable items (may link to projects/milestones) |
| **Projects** | Multi-step outcomes |
| **Milestones** | Distinct checkpoints / gates — not tasks |
| **Check-ins** | Simple v1 scores (mood/energy/focus) + optional note |
| **Finances** | Multi-currency; strict semantic separations |
| **Physical metrics** | Body / training / health measures |
| **Behavioural records** | Private; **not** default AI-accessible |
| **Reviews** | Weekly / monthly / chapter retrospectives |
| **XNINE (tracking-only)** | Notes/status only — **no** execution infra |

## Habit honesty

- **Completed** / **Partial** / **Missed** / **Not scheduled** / **Recovery** are
  first-class.
- A **missed** day stays missed in history forever.
- **Recovery** is an additional linked event that can be shown and credited
  separately — it must not overwrite the original log or fake past streaks.
- **Not scheduled** and **recovery** events are excluded from adherence
  denominators. Reporting uses two rates over expected scheduled occurrences:
  **target attainment** (completed only) and **minimum adherence**
  (completed + partial). Unlogged scheduled days are exposed as unlogged — never
  silently omitted.

## Money honesty

- Cash in/out (`deposit` / `withdrawal`) ≠ income/expense recognition.
- Transfers move value between own accounts; they are not income, expense, or profit.
- Business **revenue** and **cost** are explicit; profit is revenue − cost for
  that ledger — not a sum of mixed transaction kinds.
- Trading **PnL** is a separate performance ledger from cash.

## Product principles

1. **Truth over vanity metrics.**
2. **Semantic honesty in money.**
3. **Sensitivity by default** for behavioural and detailed financial data.
4. **Modular monolith.**
5. **User ownership** + RLS (+ composite FKs against cross-user refs).
6. **Portability** — JSON **and** CSV exports.
7. **Human in the loop** for irreversible ops and sensitive AI access.

## Defaults (provisional — see DECISIONS D013–D023)

- Timezone: `Europe/Bucharest`
- Base currency: `RON` (multi-currency accounts allowed)
- Auth: email/password primary; magic-link fallback; no public signup
- Check-in v1: mood, energy, focus (1–5) + optional note

## Non-goals (foundation / near-term)

- Multi-tenant SaaS launch
- Social feeds or public sharing
- XNINE trading / job execution integration
- Kubernetes, Redis, or unnecessary distributed systems
- Applying database migrations during Phase 0 / 0.1
- Vercel deploy during Phase 1
- Assuming any pre-existing hosted Supabase project is safe to modify

## Success criteria by phase

| Milestone | Success |
|-----------|---------|
| **Phase 1** | Sign in (email/password; magic-link fallback), chapter + module activation, habit log with correct statuses and linked recovery, project/milestone/task tree — against **DEV** Supabase; **no** Vercel |
| **Phase 2** | Check-ins, weekly reviews, physical metrics (soft-gated) — implemented pending M4 acceptance |
| **Later v0** | Finances with honest semantics, exports, behavioural, MCP — per ROADMAP Phases 3–5 |
| **AI** | Sensitive modules remain closed unless explicitly unlocked |
