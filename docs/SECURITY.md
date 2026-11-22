# Personal OS — Security

## Threat model (abbreviated)

Personal OS holds private life, health, behavioural, and financial data for a
small number of trusted users (initially one). Primary risks: credential leak,
over-broad AI/MCP access, RLS gaps, destructive automation, and accidental
cross-wiring to XNINE infrastructure.

## Autonomy levels (enforcement intent)

See `AGENTS.md` for L1 / L2 / L3 definitions.

| Action | Minimum level |
|--------|----------------|
| Edit docs / rules | L1 |
| Feature code on branch | L1 within approved phase |
| Change RLS or auth config | L2 (L3 in production) |
| Apply hosted migrations | L3 |
| Deploy web or MCP | L3 |
| Start Docker / local DB | L3 |
| Sensitive MCP reads / AI unlock | L3 + confirmation |
| Destructive deletes / bulk wipe | L3 + confirmation |
| Touch XNINE execution infra | Forbidden |

## Secrets hygiene

- Never commit `.env`, API keys, JWTs, service role keys, or DB URLs with
  passwords.
- `.gitignore` already ignores `.env` and `.env.*` (keeps `.env.example`).
- Use `.env.example` with **placeholder names only**.
- Never reuse XNINE DB credentials or project refs.
- Do not paste secrets into issues, PR bodies, or agent chat.

## RLS approach

1. RLS enabled on all user-owned tables.
2. Policies keyed on `auth.uid() = user_id`.
3. Browser uses anon key + user session only.
4. Service role only on trusted server (Next.js server / MCP host).
5. Defence in depth: application checks for sensitive modules even when RLS
   passes (AI access flags, confirmation tokens).

## Sensitive modules

| Data | Default AI/MCP | Notes |
|------|----------------|-------|
| Behavioural records | Denied | `ai_accessible` default false |
| Finance details / PnL | Denied | Aggregates only if later approved |
| Check-in narratives | Denied / redacted | |
| Physical metrics | Allowed summary | Raw notes may escalate |
| Habit/task/project metadata | Allowed | |

## Export / portability

- User must be able to export their data (JSON and/or CSV packs) via an admin
  confirmation flow.
- Exports are audited; download links time-limited.
- No silent third-party exfiltration tools.

## Destructive operations

Require L3 human approval **and** MCP/UI confirmation:

- Delete chapter and cascading data
- Bulk delete finance or behavioural history
- Reset user account data
- Disable RLS (should essentially never happen)

## Audit trail

- Append-only `audit_logs` for important mutations and all MCP admin/sensitive
  tools.
- Agents must not invent ways to erase audit rows from clients.
- Metadata must exclude secrets and minimize sensitive payloads.

## Dependency / supply chain (initial)

- Lockfiles once the app is scaffolded.
- Prefer official Supabase / Vercel / MCP SDK packages.
- No unsigned binary secrets in the repo.

## Testing security (initial)

- Unit-test permission helpers and sensitive-flag defaults (Vitest).
- Playwright: ensure logged-out users cannot see another user’s pages; basic
  ownership smoke when multi-user appears.
- Manual checklist before first hosted migration: RLS on, no XNINE refs, no
  service role in client bundle.

## Incident defaults

If a secret may have leaked: rotate hosted keys immediately (human), purge from
git history if committed, document in `docs/DECISIONS.md`.
