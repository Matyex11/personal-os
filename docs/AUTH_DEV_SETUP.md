# Auth DEV setup (human review — do not silently change hosted settings)

Target project: **personal-os-dev** (`qyysmgwdvhftbgwhpbjt`, `eu-central-1`).

## Required hosted Auth configuration (review before changing)

1. **URL configuration**
   - Site URL: `http://127.0.0.1:3000` (local Phase 1B)
   - Redirect URLs allowlist must include:
     - `http://127.0.0.1:3000/auth/callback`
     - `http://localhost:3000/auth/callback` (optional convenience)
2. **Email / magic link**
   - Enable Email provider
   - Confirm magic link / OTP email templates work for the operator inbox
   - For local DEV, disable confirmations only if human accepts the security tradeoff
3. **No public signup**
   - App calls `signInWithOtp` with **`shouldCreateUser: false`**
   - Unknown emails do not create accounts
   - **First DEV account:** create manually in the Supabase Auth dashboard
     (or invite) for the operator email, then use magic link sign-in
   - Do not enable open self-serve signup for Personal OS v0
4. **Keys**
   - App uses **publishable** key only (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - Do **not** put service-role in the Next.js app for routine ops
   - Never expose service-role to agents / MCP tool results

## App routes & safeguards

| Route / helper | Purpose |
|----------------|---------|
| `/login` | Request magic link; sanitizes `next` via `safeNextPath` |
| `/auth/callback` | Exchange code for session; **`next` must be same-origin relative** |
| `/auth/signout` | POST sign-out |
| `src/lib/auth/safe-next-path.ts` | Rejects absolute, protocol-relative (`//…`), backslash, embedded `://`; fallback `/` |
| `src/proxy.ts` | Session refresh via `getClaims()` + protect non-public routes |

Vitest coverage: `tests/unit/safe-next-path.test.ts`.

## Note

This document is a checklist for the human operator. Agents must not alter hosted
Auth settings without explicit approval.
