---
type: runbook
status: accepted
last_reviewed: 2026-11-13
---

# Moving the Supabase project to another region

Done once, from Mumbai to Tokyo, on 11–13 November 2026. These are the steps that worked. The scripts live outside this repo, in the owner's workspace (`tools/tokyo-move/`), because they read database connection strings. They print project ids and counts, never the strings.

## When to use it

Moving Bento's database to a new Supabase project (another region, or a fresh project).

## Before you start

- The new project exists and is active (a paused project must be restored first).
- Both database passwords are known. Reset them in Project Settings → Database if needed; the app doesn't use them. Put both **Session pooler** connection strings in the scripts' private env file. Never put them in chat or in the repo.
- A quiet time for the switch, about 15 minutes, with nobody using Bento.

## Steps

1. **Check both connections:** `check.cjs` shows which project each string reaches. Try once; repeated failed logins can get your IP banned.
2. **Build the schema:** `apply.cjs` applies the missing migrations, byte-exact from git, in one transaction, then compares the new project's structure with the old one in 19 categories.
   - Run it dry first; it undoes everything.
   - Then run it with `--commit`; it commits only if the comparison is clean.
   - Things found on 2026-11-12:
     - functions pasted through the SQL editor carry Windows line breaks, so the comparison ignores them;
     - one function had a setting made by hand that no migration contained, so the script adds it.
3. **Check security:** Supabase's security advisors on the new project should match the old one's.
4. **Auth settings by hand** on the new project:
   - Site URL and redirect URLs;
   - email templates (token-hash links; see [deploying](deploying.md));
   - SMTP ([email](email-smtp.md));
   - email confirmation, password rules, TOTP;
   - Google, if used.
5. **Rehearse the copy:** `copy.cjs` with no flag copies all data and user accounts, checks every table row for row, then undoes it.
6. **The switch:**
   1. `copy.cjs --commit`: copy for real; it commits only if every table matches.
   2. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` to the new project, for Production **and** Preview.
   3. If the region changes, merge the change to `regions` in `bento/vercel.json` and the privacy page's "where" wording. Merging deploys.
   4. `compare.cjs`, read-only on both sides: no differences outside the counters means nothing was written to the old project during the switch.
7. **After:** everyone signs in again, since sessions aren't copied (the new project has its own signing keys). Admins set up two-factor again, since authenticator setups aren't copied. Update local `.env.local` files. Pause the old project; delete it after about two weeks.

## How to check it worked

- `x-vercel-id` shows the new region; the security policy names the new project's address.
- A **fresh** sign-in with each method works, and the sign-in limiter records it.
- The new project's logs show the app's requests.

## How to undo it

While the old project is only paused: set the three Vercel variables back and redeploy. Anything written to the new project after the switch would need copying back.
