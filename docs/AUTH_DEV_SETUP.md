# Auth DEV setup (human review — do not silently change hosted settings)

Target project: **personal-os-dev** (`qyysmgwdvhftbgwhpbjt`, `eu-central-1`).

## Required hosted Auth configuration (review before changing)

1. **URL configuration**
   - Site URL: `http://127.0.0.1:3000` (local Phase 1B)
   - Redirect URLs allowlist must include:
     - `http://127.0.0.1:3000/auth/callback`
     - `http://localhost:3000/auth/callback` (optional convenience)
2. **Email / magic link + password**
   - Enable Email provider (password + magic link / OTP)
   - Confirm magic link / OTP email templates work for the operator inbox
   - For local DEV, disable confirmations only if human accepts the security tradeoff
   - **Do not** enable public signup or email recovery for Personal OS v0 unless explicitly approved
3. **No public signup**
   - App password path uses `signInWithPassword` (existing users only)
   - App magic-link path calls `signInWithOtp` with **`shouldCreateUser: false`**
   - Unknown emails do not create accounts
   - **First DEV account:** create manually in the Supabase Auth dashboard
     (or invite), then either set a password in **Settings** after magic-link sign-in
     or set a password from the Auth dashboard for that user
   - Do not enable open self-serve signup for Personal OS v0
4. **Keys**
   - App uses **publishable** key only (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - Do **not** put service-role in the Next.js app for routine ops
   - Never expose service-role to agents / MCP tool results

## App routes & safeguards

| Route / helper | Purpose |
|----------------|---------|
| `/login` | Email+password (`signInWithPassword`) with magic-link fallback; sanitizes `next` via `safeNextPath` |
| `/settings` (Password card) | Signed-in password set/change via `updateUser` (no public recovery) |
| `/auth/callback` | Exchange code for session; **`next` must be same-origin relative** |
| `/auth/signout` | POST sign-out |
| `src/lib/auth/safe-next-path.ts` | Rejects absolute, protocol-relative (`//…`), backslash, embedded `://`; fallback `/` |
| `src/proxy.ts` | Session refresh via `getClaims()` + protect non-public routes |

Vitest coverage: `tests/unit/safe-next-path.test.ts`, `tests/unit/password.test.ts`, `tests/unit/login-form.test.tsx`.

## Human password setup (Stage 1)

1. Ensure the Auth user exists in **personal-os-dev** (manual create/invite — no app signup).
2. Sign in once (magic link is fine if the user has no password yet).
3. Open **Settings → Password**, set a strong password (**at least 12 characters**, matching app `PASSWORD_MIN_LENGTH`), save.
4. Sign out and confirm **Sign in** with email + password works.
5. For Playwright: export `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` for a **dedicated** test user (not operator daily account if avoidable). Preflight writes gitignored `tests/e2e/.auth/user.json`.

If password change fails with a reauthentication requirement, complete a fresh sign-in and retry — do not weaken hosted Auth reauth / secure-password-change settings from an agent.

## Note

This document is a checklist for the human operator. Agents must not alter hosted
Auth settings without explicit approval.
