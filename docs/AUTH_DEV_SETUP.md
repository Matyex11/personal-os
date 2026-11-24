# Auth DEV setup (human review — do not silently change hosted settings)

Target project: **personal-os-dev** (`qyysmgwdvhftbgwhpbjt`, `eu-central-1`).

## Auth model (v0)

| Concern | Policy |
|---------|--------|
| Primary sign-in | **Email + password** (`signInWithPassword`) |
| Fallback | **Magic link / OTP** (`signInWithOtp` with `shouldCreateUser: false`) |
| Public signup | **Disabled** — app never creates users; unknown emails do not get accounts |
| Password length | **≥ 12 characters** for set/change (`PASSWORD_MIN_LENGTH` in `src/lib/auth/password.ts`) |
| Password recovery | **No** public recovery UI. Manual recovery only via a **trusted Supabase Auth admin** on the DEV project |
| Browser keys | **Publishable** key only — **never** put service-role in the Next.js app or browser |
| First DEV account | Create/invite manually in the Supabase Auth dashboard, then set a password (Settings after first sign-in, or Auth dashboard) |
| Playwright | Dedicated **DEV E2E account** with a password; credentials via shell env only (names below) |

Obsolete “magic-link-only” instructions no longer apply. Magic link remains a
fallback for operators without a password yet, not the primary path.

## Required hosted Auth configuration (review before changing)

1. **URL configuration**
   - Site URL: `http://127.0.0.1:3000` (local Phase 1B)
   - Redirect URLs allowlist must include:
     - `http://127.0.0.1:3000/auth/callback`
     - `http://localhost:3000/auth/callback` (optional convenience)
2. **Email provider**
   - Enable Email (password + magic link / OTP)
   - Confirm magic-link / OTP templates work for the operator inbox
   - For local DEV, disable confirmations only if human accepts the security tradeoff
   - **Do not** enable public signup or email recovery for Personal OS v0 unless explicitly approved
3. **No public signup**
   - Password path: existing users only
   - Magic-link path: `shouldCreateUser: false`
   - First account: manual create/invite only
4. **Keys**
   - App uses **publishable** key only (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - Do **not** put service-role in the Next.js app for routine ops
   - Never expose service-role to agents / MCP tool results

## App routes & safeguards

| Route / helper | Purpose |
|----------------|---------|
| `/login` | Email+password primary; magic-link fallback; sanitizes `next` via `safeNextPath` |
| `/settings` (Password card) | Signed-in password set/change via `updateUser` (no public recovery) |
| `/auth/callback` | Exchange code for session; **`next` must be same-origin relative** |
| `/auth/signout` | POST sign-out |
| `src/lib/auth/safe-next-path.ts` | Rejects absolute, protocol-relative (`//…`), backslash, embedded `://`; fallback `/` |
| `src/proxy.ts` | Session refresh via `getClaims()` + protect non-public routes |

Vitest coverage: `tests/unit/safe-next-path.test.ts`, `tests/unit/password.test.ts`,
`tests/unit/login-form.test.tsx`, `tests/unit/password-settings-form.test.tsx`.

## Human password setup

1. Ensure the Auth user exists in **personal-os-dev** (manual create/invite — no app signup).
2. Sign in once (magic link is fine if the user has no password yet).
3. Open **Settings → Password**, set a strong password (**at least 12 characters**), save.
4. Sign out and confirm **Sign in** with email + password works.
5. Prefer a **dedicated E2E test user** (not the operator daily account) for Playwright.

If password change fails with a reauthentication requirement, complete a fresh
sign-in and retry — do not weaken hosted Auth reauth / secure-password-change
settings from an agent.

Lost-password recovery: have a trusted operator reset the password in the
Supabase Auth dashboard. Do not enable public email recovery unless explicitly approved.

## Playwright (P2.3) — operational guide

Projects in `playwright.config.ts`:

| Project | Role |
|---------|------|
| `chromium` | Unauthenticated / public flows; ignores `authenticated/` and `auth.preflight.ts` |
| `auth-preflight` | Password login → writes gitignored `tests/e2e/.auth/user.json` |
| `chromium-authenticated` | Vertical-slice specs under `tests/e2e/authenticated/`; depends on preflight; `workers: 1` |

### Required env var **names** (values never documented here)

| Name | Purpose |
|------|---------|
| `E2E_USER_EMAIL` | Dedicated personal-os-dev test user email |
| `E2E_USER_PASSWORD` | That user’s password (must already exist; ≥ 12 chars if set via app) |

Set them in the **shell** (or a local secret store). Do **not** invent credentials,
commit values, or put service-role in the browser. `.env.example` lists the names
as commented placeholders only. Preflight does **not** read `.env.local`.

Also required for the app under test (already used by Next; not Playwright-specific):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

### Generate / refresh storage state

```bash
# From repo root, with E2E_USER_EMAIL and E2E_USER_PASSWORD set in the shell:
npm run test:e2e:authenticated
# or:
npx playwright test --project=chromium-authenticated
```

`auth-preflight` signs in with password and writes
`tests/e2e/.auth/user.json` (gitignored via `/tests/e2e/.auth/`). Never commit
that file; never paste its contents into chat or docs.

### Reuse an existing session (`--no-deps`)

When `tests/e2e/.auth/user.json` already exists and is still a live session:

```bash
npx playwright test --project=chromium-authenticated --no-deps --workers=1
```

`--no-deps` skips `auth-preflight`, so shell `E2E_USER_*` are not required for
that run. Use this only when the storage state is known-good. If session expired
or smoke lands on `/login`, refresh with credentials (full authenticated run
without `--no-deps`).

### Unauthenticated suite

```bash
npm run test:e2e
# or:
npx playwright test --project=chromium --workers=1
```

Credential-gated cases in `password-login.spec.ts` **skip** when `E2E_USER_*`
are unset (fail-closed; no invented logins).

### Why `--workers=1` for authenticated

Authenticated suites mutate shared DEV state for one account (current chapter,
module overrides, profile display name). Parallel workers would race restores
and leave inconsistent state. `chromium-authenticated` sets `workers: 1` and
`fullyParallel: false`; keep `--workers=1` when invoking manually.

### What is restored vs what remains on DEV

Suites use unique `e2e-p23-<runId>-…` names. App clients have **no DELETE** on
domain tables, so throwaway rows are not auto-deleted.

| State | Behavior |
|-------|----------|
| Profile display name | Mutated then **restored** (+ reload verify); timezone/currency untouched |
| Previous current chapter | **Restored** via Make current when safely available |
| Global module on/off | Captured at suite start; **restored** to that snapshot (Enable/Disable only) |
| Prior chapter override *sources* | Re-asserted after restore (must match capture) |
| E2E chapters | Remain **active, non-current** after restore |
| Chapter overrides on E2E chapters | Remain (app has no inherit-clear / DELETE) |
| Habits + missed/recovery logs | Remain (append-only history) |
| Projects / milestones / tasks | Remain |
| Auth password | Not mutated by vertical-slice e2e (password-setting spec is client validation only) |

### Artifacts / secrets hygiene

- `tests/e2e/.auth/` — gitignored (session cookies/tokens)
- `test-results/`, `playwright-report/` — gitignored
- Never stage those paths; never document emails, passwords, or session JSON

## Note

This document is a checklist for the human operator. Agents must not alter hosted
Auth settings without explicit approval.
