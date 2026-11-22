# Personal OS — MCP Specification

## Purpose

A **dedicated Personal OS MCP server** exposes audited tools so Cursor (and
future agents) can help operate the user’s OS. It is **not** the XNINE ops MCP
and must never share credentials or tool namespaces with XNINE execution infra.

## Deployment principles

- Separate process/host from the Next.js app on Vercel.
- Uses Personal OS Supabase credentials only (server-side).
- Every mutating or sensitive read tool writes an `audit_logs` row.
- Important ops require an explicit confirmation token / two-step tool pattern.
- Sensitive modules default to **deny** for AI tool access.

## Permission tiers

| Tier | Capabilities | Default tools |
|------|--------------|---------------|
| **read** | Non-sensitive SELECT-shaped tools | Chapters summary, active modules, habit streak summaries, task/project lists, physical metric summaries, review outlines |
| **write** | Create/update non-destructive records | Log habit, add task, update project status, create check-in draft |
| **admin** | Destructive, bulk, export, policy, sensitive unlock | Delete chapter data, bulk finance import, export all, toggle `ai_accessible`, apply schema (human-gated outside MCP ideally) |

Autonomy mapping: read ≈ L1 inside MCP session policy; write ≈ L2; admin ≈ L3
with human confirmation.

## Sensitive module restrictions

| Module | MCP default | Unlock |
|--------|-------------|--------|
| Behavioural records | **Denied** | User sets `ai_accessible` + confirmation tool |
| Finance transactions / PnL details | **Denied** (aggregates optional later) | Explicit unlock + audit |
| Check-in free text | **Denied** or redacted | Opt-in |
| XNINE tracking notes | Read allowed if non-secret; **no** execution tools | N/A — execution forbidden |
| Audit logs | Read own summary | No delete via MCP |

## Confirmation pattern (important ops)

1. Agent calls `propose_*` tool → server returns `confirmation_id` + human-readable diff.
2. Human approves in UI or chat.
3. Agent calls `confirm_*` with `confirmation_id` (short TTL, single use).
4. Server executes, audits, returns result.

Applies to: deletes, bulk edits, exports, sensitive reads, module AI unlocks.

## Example tools (starting point — not implemented yet)

### Read

| Tool | Tier | Notes |
|------|------|-------|
| `get_current_chapter` | read | Where am I |
| `list_active_modules` | read | |
| `list_habits` | read | Metadata only |
| `summarize_habit_adherence` | read | Uses statuses correctly; no silent rewrite |
| `list_projects` | read | Includes milestone counts, not nested secrets |
| `list_open_tasks` | read | |
| `get_weekly_review_stub` | read | Structure without private behavioural bodies |

### Write

| Tool | Tier | Notes |
|------|------|-------|
| `log_habit` | write | Status enum enforced |
| `create_task` | write | |
| `update_task_status` | write | |
| `create_project` | write | |
| `create_milestone` | write | Separate from tasks |
| `upsert_check_in` | write | May escalate if body present |
| `upsert_xnine_tracking_item` | write | Tracking only |

### Admin / gated

| Tool | Tier | Notes |
|------|------|-------|
| `propose_delete_entity` / `confirm_delete_entity` | admin | |
| `propose_export_user_data` / `confirm_export_user_data` | admin | Portability |
| `propose_sensitive_read` / `confirm_sensitive_read` | admin | Behavioural/finance |
| `propose_set_ai_accessible` / `confirm_set_ai_accessible` | admin | Per-record or per-module |

## Explicit non-tools

- Anything that starts jobs on XNINE infra
- Raw SQL execution
- Service-role credential disclosure
- Silent backfill of habit history as `completed`

## Audit requirements

Every tool invocation stores at minimum: tool name, tier, actor, args hash /
safe metadata, success/failure, `confirmation_id` if any. Never store API keys
or full sensitive bodies in audit metadata.

## Relation to Cursor

- Personal OS MCP is configured in the user’s MCP settings for this project.
- Presence of Supabase MCP (if any) does **not** grant unrestricted production
  access; agents still follow L2/L3 and this spec.
- Foundation phase: document only — **do not implement or deploy** the MCP
  server yet (see Roadmap phase after app vertical slice).
