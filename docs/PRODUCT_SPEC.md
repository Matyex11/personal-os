# Personal OS — Product Spec

## Mission

Personal OS is a private, modular life-operating system for one primary user
(expandable later). It answers three recurring questions with trustworthy data
and deliberate reflection—not generic productivity noise.

## Three core questions

1. **Where am I?** — Current chapter, active modules, habits, tasks, physical and
   financial baselines, recent check-ins.
2. **What matters now?** — Prioritized projects, milestones, recovery needs, and
   commitments that deserve attention this week.
3. **How did I actually do?** — Honest review of habits (including Partial /
   Missed / Recovery), projects vs milestones, finances (revenue ≠ profit;
   trading PnL ≠ cash movement), and behavioural patterns the user chooses to
   surface.

## Modules (activation is per-user / per-chapter)

| Module | Purpose |
|--------|---------|
| **Chapters / History** | Named life periods; context for what “counts” now |
| **Module activation** | Which domains are live in the current chapter |
| **Habits** | Recurring behaviours with min vs target and nuanced statuses |
| **Tasks** | Atomic actionable items (may link to projects) |
| **Projects** | Multi-step outcomes with optional milestones |
| **Milestones** | Distinct from projects and tasks — checkpoints / gates |
| **Check-ins** | Periodic structured self-reports |
| **Finances** | Multi-currency money tracking with strict semantic separations |
| **Physical metrics** | Body / training / health measures the user tracks |
| **Behavioural records** | Private notes/patterns; **not** default AI-accessible |
| **Reviews** | Weekly / monthly / chapter retrospectives |
| **XNINE (tracking-only)** | Status / notes about XNINE work; **no** execution infra |

## Product principles

1. **Truth over vanity metrics.** Partial and Missed are first-class; Recovery is
   explicit, not silent backfill.
2. **Semantic honesty in money.** Trading PnL ≠ deposits/withdrawals; revenue ≠
   profit; employment / freelance / business stay categorized.
3. **Sensitivity by default.** Behavioural and detailed financial data are
   private; AI/MCP access is opt-in and audited.
4. **Modular monolith.** One app, clear module boundaries—not a microservice
   fleet.
5. **User ownership.** Every row traces to an authenticated user; RLS is
   non-negotiable.
6. **Portability.** Exports must be possible without vendor lock-in theatre.
7. **Human in the loop for irreversible ops.** Deletes, bulk mutations, and
   sensitive AI access require confirmation.

## Non-goals (foundation / near-term)

- Multi-tenant SaaS launch
- Social feeds or public sharing
- XNINE trading / job execution integration
- Kubernetes, Redis, or unnecessary distributed systems
- Applying database migrations during the foundation phase

## Success for v0 (after foundation)

A signed-in user can activate core modules, log habits with correct statuses,
create a project with milestones and tasks, complete a check-in, and see a
simple “where am I / what matters” home—without exposing sensitive modules to
AI by default.
