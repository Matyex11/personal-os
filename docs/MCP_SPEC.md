# Personal OS — MCP Specification

## Purpose

A **dedicated Personal OS MCP server** (in-repo package `mcp/`, D016) exposes
audited tools so Cursor and future agents can help operate the user’s OS. It is
**not** the XNINE ops MCP and must never share credentials or tool namespaces
with XNINE execution infra.

Host vendor is **deferred** (D017); the package is designed as a separate
deployable process from the Next.js app.

## Security principles (mandatory)

1. **Server-side authorization on every tool call.** The model is untrusted.
2. **User-scoped operations only.** Effective `user_id` comes from the MCP
   session / verified identity binding — not from arbitrary client-supplied
   impersonation fields.
3. **No unrestricted database query tools.** No ad-hoc “run query” / “list all
   tables” / dump tools.
4. **No raw SQL tools.** Ever.
5. **Never expose service-role credentials** (or DB URLs with passwords) to
   agents, tool responses, prompts, or logs. Secrets stay in the MCP **host**
   environment; tools return data, not keys.
6. Sensitive modules default to **deny**; sensitive reads use propose/confirm +
   audit + eligibility checks (`ai_accessible`, etc.).
7. Important mutations use confirmation tokens; all admin/sensitive calls audit.
8. Supabase MCP (if present in Cursor) is **not** a substitute for this server
   and does **not** authorize production/dev schema changes.

## Authorization flow (per tool)

```
agent tool call
  → authenticate MCP session
  → resolve bound user_id
  → check tool tier vs session grants
  → check module sensitivity / ai_accessible
  → (admin) require valid confirmation_id when needed
  → execute via domain services (RLS-aware or carefully scoped server path)
  → write audit_logs (no secrets in metadata)
  → return safe payload
```

Permission checks fail closed. Ambiguous identity → deny.

## Permission tiers

| Tier | Capabilities | Autonomy mapping |
|------|--------------|------------------|
| **read** | Non-sensitive, explicit read tools | ≈ L1 within MCP policy |
| **write** | Non-destructive creates/updates on allowed modules | ≈ L2 (prefer human-visible) |
| **admin** | Destructive, bulk, export, sensitive unlock | ≈ L3 + confirmation |

Schema migrate / `db push` is **not** an MCP admin convenience — it remains a
human L3 ops action outside this tool surface (or a future explicitly approved
tool, default off).

## Sensitive module restrictions

| Module | MCP default | Unlock |
|--------|-------------|--------|
| Behavioural records | **Denied** | `ai_accessible` + propose/confirm + audit |
| Finance transactions / business ledgers / PnL | **Denied** | Explicit unlock + audit; no “profit” tool that mixes kinds |
| Check-in free text | **Denied** / redacted | Opt-in |
| Habit recovery links | Allowed as metadata | Must not rewrite original miss |
| XNINE tracking notes | Read if non-secret | **No** execution tools |
| Audit logs | Read own summary | No delete |

## Confirmation pattern

1. `propose_*` → `confirmation_id` + human-readable diff (TTL, single-use).
2. Human approves.
3. `confirm_*` with `confirmation_id`.
4. Server executes, audits, returns result.

Required for: deletes, bulk edits, exports, sensitive reads, AI accessibility
toggles.

## Example tools (starting point — not implemented)

### Read

| Tool | Tier | Notes |
|------|------|-------|
| `get_current_chapter` | read | |
| `list_active_modules` | read | Resolved global vs chapter |
| `list_habits` | read | Metadata |
| `summarize_habit_adherence` | read | Honors status table; miss preserved; recovery separate |
| `list_projects` | read | |
| `list_open_tasks` | read | |
| `get_weekly_review_stub` | read | No behavioural bodies |

### Write

| Tool | Tier | Notes |
|------|------|-------|
| `log_habit` | write | Enum enforced; cannot “complete” by editing a miss |
| `create_habit_recovery` | write | Creates recovery row linked to original log |
| `create_task` / `update_task_status` | write | |
| `create_project` / `create_milestone` | write | Separate concepts |
| `upsert_check_in` | write | May escalate if `body` present |
| `upsert_xnine_tracking_item` | write | Tracking only |

### Admin / gated

| Tool | Tier | Notes |
|------|------|-------|
| `propose_delete_entity` / `confirm_delete_entity` | admin | |
| `propose_export_user_data` / `confirm_export_user_data` | admin | JSON **and** CSV (D022) |
| `propose_sensitive_read` / `confirm_sensitive_read` | admin | AuthZ + audit |
| `propose_set_ai_accessible` / `confirm_set_ai_accessible` | admin | |

## Explicit non-tools

- Raw SQL / unrestricted query
- Service-role or secret disclosure
- XNINE job execution
- Silent rewrite of habit history (`missed` → `completed`)
- Generic “compute profit” over all transactions
- Schema apply / production mutate

## Audit requirements

Every invocation: tool name, tier, bound user id, actor, safe args metadata,
success/failure, `confirmation_id` if any. Never store API keys, service role,
or full sensitive bodies.

## Relation to architecture

- MCP is a façade over domain services (`docs/ARCHITECTURE.md`), not a parallel
  data layer.
- Implementation phase: **Phase 4** (`docs/ROADMAP.md`). Foundation/0.1:
  documentation only.
