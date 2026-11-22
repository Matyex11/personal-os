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
3. **Keys**
   - App uses **publishable** key only (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`)
   - Do **not** put service-role in the Next.js app for routine ops

## App routes

| Route | Purpose |
|-------|---------|
| `/login` | Request magic link |
| `/auth/callback` | Exchange code for session cookies |
| `/auth/signout` | POST sign-out |
| `src/proxy.ts` | Session refresh via `getClaims()` + protect non-public routes |

## Note

This document is a checklist for the human operator. Agents must not alter hosted
Auth settings without explicit approval.
