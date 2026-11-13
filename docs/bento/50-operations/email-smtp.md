---
type: runbook
status: accepted
last_reviewed: 2026-11-13
---

# Email: sending through Gmail SMTP

Bento's sign-in emails (confirmations, password resets, security notices) are sent by Supabase Auth through Bento's Gmail account.

## When to use it

Setting up email on a new Supabase project, or when emails stop arriving.

## Before you start

- **2-Step Verification must be on** for the sending Google account. Without it, an app password can't be created or used, and Gmail refuses the login. The "Is it you?" prompts Google sends to a phone aren't 2-Step Verification.

## Steps

1. Signed in as the sending account, open myaccount.google.com/apppasswords, create an app password (named, for example, "Supabase Bento"), and copy the 16 letters.
2. Supabase → Authentication → Emails → SMTP Settings → enable custom SMTP:
   - Sender email: the Gmail address itself (Gmail rewrites any other sender address);
   - Host `smtp.gmail.com`, port `465`;
   - Username: the full Gmail address;
   - Password: the app password, **without spaces**. The box always looks empty, so paste it again whenever you save.
3. Save. Then set the email rate limit under Authentication → Rate Limits.

## How to check it worked

- Request "Forgot password" for your own address; it arrives (check spam).
- The Auth logs show the request completing with status 200.
- To test the login without sending anything, the owner's workspace has `tools/smtp-check.cjs`.

## If emails fail

Search the Auth logs:
- `535 … Username and Password not accepted`: the app password is wrong or missing, or 2-Step Verification is off;
- `534`: Google blocked the sign-in.

The app itself shows nothing; the user simply never gets the email.

## Limits

A personal Gmail account sends about 500 emails a day. When Bento outgrows that, use a transactional email service with Bento's own domain.

Lesson: `knowledge/lessons/2026-11-13-gmail-smtp-needs-2sv.md` (shared knowledge base).
