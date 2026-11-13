---
type: non-functional
status: accepted
implementation: shipped
code:
  - bento/src/lib/guards/
  - bento/src/lib/security/
  - bento/src/lib/supabase/
  - bento/src/proxy.ts
  - bento/supabase/migrations/0029_security_hardening.sql
last_reviewed: 2026-11-13
---

# Security

## Target

| # | Requirement |
|---|---|
| S1 | Every user table has row-level security; travellers reach only their own rows |
| S2 | Supabase is only called from the server; session cookies are httpOnly, and https-only in production; there's no browser-side Supabase client |
| S3 | Every password, reset and two-factor attempt passes `authGate` (rate limits per visitor address, per email, and per account) **before** Supabase is asked; when the limiter can't answer, the attempt is refused |
| S4 | An email link never signs straight in: `/auth/confirm` shows the account and needs **Continue**, bound to that account |
| S5 | A content security policy is **enforced** in production; violations are reported |
| S6 | Redirects after sign-in go through `safeNext` ("starts with /" isn't enough: `//evil` leaves the site) |
| S7 | Every new view revokes insert, update and delete from `anon` and `authenticated`; every `SECURITY DEFINER` function sets a safe `search_path` |
| S8 | The database bounds direct writes: row caps per parent, 90 nights a city, a year a trip, and 1 MB a statement and 10 MB a day per account |
| S9 | Booking references are encrypted at rest (AES-256-GCM), never logged, never put in a model prompt |
| S10 | Admin pages and actions need an admin **and** a second factor this session (`requireAdmin()`) |
| S11 | The scheduled job's bearer check is timing-safe; the server doesn't advertise its software |

## How it's checked

- Unit tests run on every change (`npm test`); see Evidence.
- Supabase's security advisors after every schema change. On 13 November 2026, Tokyo and Mumbai showed the same findings, all expected:
  - views that run with their owner's rights, on purpose, to hide unverified fields;
  - the shared-trip function open to anyone;
  - tables with RLS on but no policy, which only database functions use.
- A fresh sign-in after any deploy that touches sign-in (see [deploying](../50-operations/deploying.md)).
- A security review checklist: `knowledge/checklists/security.md` in the shared knowledge base.

## Evidence

- S3: `bento/src/lib/guards/__tests__/auth-limit.test.ts`. Live check, 13 November 2026: a fresh sign-in and a 2FA code each recorded a limiter bucket on Tokyo.
- S2: `bento/src/lib/supabase/cookie-options.test.ts`.
- S4: `bento/src/lib/pending-sign-in.test.ts`, `bento/src/app/__tests__/confirm-sign-in.test.ts`.
- S5: `bento/src/lib/security/csp.test.ts`; `client-imports.test.ts` keeps zod out of the browser bundle (its `Function("")` probe broke the policy). Live check: the enforced header is served (13 November 2026).
- S6: `bento/src/lib/safe-next.test.ts`.
- S7: `bento/src/lib/db/definer-functions.test.ts`; migration `0013_lock_public_views.sql`.
- S8: migration `0029_security_hardening.sql`, tested on PGlite (31 checks, 30 October 2026) and applied to both projects.
- S9: `bento/src/lib/vault/__tests__/crypto.test.ts`, `redact.test.ts`.
- S11: `bento/src/lib/security/bearer.test.ts`; `poweredByHeader: false` in `next.config.ts`.
- The security review of 30 October 2026, with Codex reviews of the fixes: PR #64.

## Known gaps

- `authGate` doesn't cover someone calling Supabase Auth directly with the public key; only Supabase's own per-IP limits apply there. A CAPTCHA (such as Turnstile) turned on in Supabase would close it; that's the owner's decision.
- Row caps can be overshot slightly by parallel requests (accepted in the review).
- The content security policy still allows `'unsafe-inline'`; per-request nonces through the proxy are the next step.
- Leaked-password protection needs Supabase's paid plan.
- A security event log is planned, not built.

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Invariants".
