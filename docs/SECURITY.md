# Personal OS — Security

## Threat model (abbreviated)

Personal OS holds private life, health, behavioural, and financial data for a
**single primary user** in v0 (schema remains user-scoped for safety). Primary
risks: credential leak, over-broad AI/MCP access, RLS/FK gaps enabling
cross-user refs, destructive automation, migrating the wrong Supabase project,
and accidental cross-wiring to XNINE infrastructure.

## Environment separation

| Target | Policy |
|--------|--------|
| Supabase **DEV** (dedicated EU Personal OS project) | Only approved target for schema experiments; L3 to apply migrations |
| Supabase **PROD** | Separate project; L3 only; never default |
| Unknown / pre-existing hosted project | **Do not assume linked or safe** — do not modify |
| Docker local DB | Optional; **stopped**; L3 to start |
| XNINE projects | Forbidden |

Agents must not “discover and push” to whatever Supabase MCP happens to expose.

## Autonomy levels (enforcement intent)

Canonical definitions: `AGENTS.md`. Roadmap phase gates further restrict what L1
may touch.

| Action | Minimum level |
|--------|----------------|
| Edit docs / rules | L1 |
| Feature code on branch **after Phase 1 authorized** | L1 within phase scope |
| Draft migration SQL in repo | L1 (design); **apply** = L3 |
| Change RLS or auth config in SQL/docs | L2 review; **apply** L3 |
| Apply migrations to DEV or PROD | **L3** (exact project named) |
| Deploy web or MCP | **L3** — Phase 1 includes **no** Vercel deploy (D023) |
| Start Docker / local DB | L3 |
| Sensitive MCP reads / AI unlock | L3 + confirmation |
| Destructive deletes / bulk wipe / full export | L3 + confirmation |
| Touch XNINE execution infra | Forbidden |

**Correction vs early drafts:** Applying hosted migrations is always **L3**, not
merely L2. L2 means pause for review while drafting risky changes; execution
against hosted infra remains L3.

## Secrets hygiene

- Never commit `.env`, API keys, JWTs, service role keys, or DB URLs with passwords.
- `.gitignore` ignores `.env` / `.env.*` (keeps `.env.example`).
- Never reuse XNINE credentials or project refs.
- **Never expose `SUPABASE_SERVICE_ROLE_KEY` (or equivalent) to agents**, MCP tool
  results, browser bundles, logs, or chat.
- Service role may exist only as an environment variable inside the Next.js
  server process or the MCP **host** process.

## RLS approach

Aligned with `docs/DATABASE_SCHEMA.md`:

1. RLS enabled on all user-owned tables.
2. Policies keyed on `auth.uid() = user_id`.
3. Browser: anon key + user session only.
4. Composite FKs `(user_id, parent_id)` prevent cross-user parent refs (integrity
   layer alongside RLS).
5. Defence in depth: sensitive modules need app/MCP authorization even when RLS
   allows the user to read their own rows (AI is not the user).
6. `audit_logs`: user SELECT own; no client UPDATE/DELETE; inserts from trusted
   server paths only.

## MCP authorization (mandatory)

See `docs/MCP_SPEC.md`. Summary:

- **Server-side authorization on every tool** — never trust the model to “only
  call safe tools.”
- Explicit user-scoped operations only; bind `user_id` from authenticated MCP
  session / human-approved identity, not from free-form tool args alone.
- **Prohibit** unrestricted DB query tools and raw SQL.
- Sensitive reads require propose/confirm + `ai_accessible` (or equivalent) + audit.
- Admin tools do not imply schema apply; migrations stay outside agent MCP by default.

## Sensitive modules

| Data | Default AI/MCP | Notes |
|------|----------------|-------|
| Behavioural records | Denied | `ai_accessible` default false |
| Finance details / PnL / business ledgers | Denied | No ambiguous profit tools |
| Check-in free text | Denied / redacted | Scores may be allowed later |
| Physical metrics | Allowed summary | Raw notes may escalate |
| Habit/task/project metadata | Allowed | Recovery links OK; no silent rewrite |

## Export / portability

- Support **JSON and CSV** exports (D022) via confirmation + audit.
- Time-limited download links; no silent exfiltration tools.

## Destructive operations

Require L3 human approval **and** UI/MCP confirmation:

- Delete/close-cascade chapter data
- Bulk delete finance or behavioural history
- Reset user account data
- Disable RLS (should essentially never happen)

## Habit history integrity

- Original `missed` (and other primary) logs are not rewritten by recovery.
- Security/analytics code must not “fix” history by updating past statuses.

## Audit trail

- Append-only `audit_logs` for important mutations and all MCP admin/sensitive tools.
- Metadata excludes secrets and service-role material.

## Testing security (initial)

- Vitest: permission helpers, sensitive defaults, recovery immutability helpers.
- Playwright: auth smoke; ownership once multi-session testing exists.
- Before first **DEV** migration: RLS on, composite FKs planned, correct project
  ref, no XNINE refs, no service role in client.

## Incident defaults

If a secret may have leaked: human rotates keys, purge from git history if
committed, document in `docs/DECISIONS.md`.
