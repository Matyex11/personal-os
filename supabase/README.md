# Supabase (Personal OS)

- `config.toml` — CLI config from `supabase init` (`project_id = personal-os-1`,
  Postgres 17). Preserved from repo bootstrap.
- `migrations/` — versioned SQL only. **Empty in Phase 0; nothing applied.**

## Rules

- Use the **Personal OS** hosted project for future work — never XNINE.
- Do not start Docker / local stack unless the human L3-approves.
- Do not `db push` or modify hosted tables without L3 approval.
- Schema design: `docs/DATABASE_SCHEMA.md`.

## CLI note

Global `supabase` may be missing; `npx supabase` works (verified `3.2.0` during
foundation inspection).
