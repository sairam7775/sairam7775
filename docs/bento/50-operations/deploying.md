---
type: runbook
status: accepted
code:
  - bento/vercel.json
  - bento/next.config.ts
last_reviewed: 2026-11-13
---

# Deploying

## When to use it

Setting up or changing the Vercel deployment. Day to day, **merging to `main` deploys production**, and each PR gets a preview.

## Before you start

Access to the Vercel team `bento-box` and the Supabase project.

## Settings that must be right

- **Root directory: `bento`.** The repo also holds docs and design files; without this setting, Vercel finds no `package.json`.
- **Production branch:** `main`.
- **Region:** `bento/vercel.json` pins the functions to `hnd1` (Tokyo), next to the database in `ap-northeast-1`. One chat turn makes several database round trips, so **move both together or neither** ([region move](supabase-region-move.md)).
- Security headers live in `next.config.ts`, so they apply on any host.

## Environment variables

| Variable | Where it comes from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API | Production and Preview each have their own copy |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → API keys (publishable) | Safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API keys (secret) | **Server only**: it bypasses every RLS policy |
| `BENTO_BOOKING_REF_KEY` | `openssl rand -base64 32` | Encrypts booking references. **Don't lose it:** rotating it makes every stored reference unreadable |
| `BENTO_MAN_PROVIDER`, `BENTO_MAN_MODEL`, `BENTO_MAN_EFFORT`, a model API key | The model provider | See [Bento Man (software)](../30-software/bento-man.md) |
| `BENTO_MONTHLY_SPEND_CAP_USD` | Owner's choice | AI spend per user per month; defaults to 20 ([costs](../40-non-functional/costs.md)) |
| `BENTO_GLOBAL_MONTHLY_SPEND_CAP_USD` | Owner's choice | AI spend for everyone together per month; defaults to 50 |
| `BENTO_GOOGLE_SIGN_IN` | `1` to show "Continue with Google" | Only after the Google provider is set up in Supabase |
| `NEXT_PUBLIC_SITE_URL` | The live address | Production |
| `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID` | PostHog (EU) | Analytics and its deletion ([privacy](../40-non-functional/privacy.md)) |
| `CRON_SECRET` | Random | Protects the daily analytics-deletion retry |

Production and Preview each hold their own copy of a variable; change both when switching projects.

## Supabase settings that go with a deploy

- **URL Configuration:** Site URL `https://bento-zeta-six.vercel.app`; redirect URLs `https://bento-zeta-six.vercel.app/**` and `http://localhost:3000/**` (and `https://*-bento-box.vercel.app/**` only if testing sign-in on previews).
- **Email templates** need a token-hash link, so they work in any browser. Supabase's default PKCE links only work in the browser that asked. Editing templates needs custom SMTP ([email](email-smtp.md)). The links are:
  - Reset password: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery`
  - Confirm sign up: `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`

  An email link then stops at "Is this your account?" before signing in, so no template change is needed for that.

## How to check it worked

- The deployment shows **Ready**, and `x-vercel-id` in the response headers includes `hnd1`.
- Sign in fresh (sign out first) with each method; an existing session doesn't test the sign-in code (`knowledge` lesson "test sign-in with a fresh session").

## How to undo it

Vercel → Deployments → promote the previous deployment, or revert the merge on `main`.

## Notes

- `/api/chat` has `maxDuration` 120 seconds; check it against the plan's limit.
- A fresh database gives a working sign-up and an empty product: every city is a stub until places are verified.
