---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/app/(auth)/
  - bento/src/app/auth/
  - bento/src/app/settings/
  - bento/src/lib/account/
  - bento/src/lib/admin.ts
last_reviewed: 2026-11-13
---

# Accounts, settings and admins

## Summary

Travellers sign up with email and password or with Google, must be 16 or over, and manage everything about their account in **Settings**: their name, password, appearance, privacy and data, and deleting the account. Admins (the people who curate places) have an extra Admin area protected by a second factor.

## User journey

1. **Sign up** with email (a confirmation email follows) or **Continue with Google**. Both pass the age screen (16 and over); the birth date is never stored. Sign-up names the terms and the privacy policy.
2. **Sign in.** An email sign-in link opens an "Is this your account?" page showing the address, with **Continue** and **That's not me**, so a forwarded link can't sign someone into the wrong account. Google sign-in goes straight in.
3. **Settings** is a short list, each row opening its own page:
   - Personal information (email, an optional name, password);
   - Appearance (theme, background);
   - Privacy & data (analytics consent, Delete account on its own page);
   - "Show the tour again";
   - Admin, for admins only.
4. **Admins** reach curation tools, this month's AI spend and the live model, and the admin list. Admin pages need a second factor this session (an authenticator app, set up once).

## Acceptance criteria

- Every way to create an account passes the age screen; a test keeps the privacy page, the terms and the screen's age equal.
- Every password, reset and two-factor attempt is rate-limited per visitor, per email and per account **before** Supabase is asked; when the limiter can't answer, the attempt is refused ([security](../40-non-functional/security.md)).
- A name is optional, cleaned on the way out, used only for greetings, and never sent to Bento Man, analytics or admin pages. A name saved as empty stays empty, so Google's first name doesn't come back.
- Every admin page and action calls `requireAdmin()`, which also needs the second factor. Adding or removing an admin goes through two locked database functions: they re-check that the person acting is still an admin, and refuse to remove yourself or the last admin.
- Each settings action returns the traveller to the page they were on, saying what happened.

## What it doesn't do

- Admins can't delete themselves from the interface.
- No Apple sign-in yet (deferred until there's an iPhone app; see [mobile](../60-direction/mobile.md)).

## Failure behaviour

- Too many attempts: the form says to wait; nothing reaches Supabase.
- An admin who loses their phone is recovered by removing their factor in the Supabase dashboard (Authentication → Users → the user → MFA).
- Deleting an account: see [privacy](../40-non-functional/privacy.md), including what happens if analytics deletion fails.

## Code and tests

- Sign-in and sign-up actions: `bento/src/app/(auth)/actions.ts`; the email confirm page: `bento/src/app/auth/confirm/`; the held sign-in: `bento/src/lib/pending-sign-in.ts`.
- Rate limiting: `bento/src/lib/guards/auth-limit.ts`.
- Settings pages: `bento/src/app/settings/`; the name: `bento/src/lib/account/name.ts`; deletion: `bento/src/lib/account/delete.ts`.
- Admins: `bento/src/lib/admin.ts`; the age screen: `bento/src/lib/age-gate.ts`.
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Invariants" and "Names and admins".
