# Supabase (Personal OS)

- `config.toml` — CLI config from `supabase init` (`project_id = personal-os-1`,
  Postgres 17). Preserved from repo bootstrap.
- `migrations/` — versioned SQL only. **Empty in Phase 0; nothing applied.**

## Rules

- Require a dedicated **EU DEV** Personal OS Supabase project before schema experiments; PROD is separate.
- Do **not** assume any pre-existing hosted project is linked or safe to modify.
- Never use XNINE projects or credentials.
- Do not start Docker / local stack unless the human L3-approves (default: stopped).
- Do not `db push` or modify hosted tables without L3 approval naming the exact project.
- Schema design: `docs/DATABASE_SCHEMA.md`.

## CLI note

Global `supabase` may be missing; `npx supabase` works (verified `3.2.0` during
foundation inspection).
