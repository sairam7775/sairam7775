---
type: runbook
status: accepted
code:
  - bento/.env.example
  - bento/supabase/
  - bento/scripts/grant-admin.ts
last_reviewed: 2026-11-13
---

# Local setup

## When to use it

Running Bento on your own machine, against your own Supabase project or the shared one.

## Before you start

Node 24, npm, and a Supabase project (supabase.com).

## Steps

1. **Install:** in `bento/`, run `npm ci`.
2. **Apply the migrations** in order (`bento/supabase/migrations/`), through the Supabase SQL editor or the CLI (`supabase link --project-ref YOUR-REF`, then `supabase db push`). Then the seeds, **in this order**, because places reference stations:

   ```bash
   psql "$DATABASE_URL" -f supabase/seed.sql
   psql "$DATABASE_URL" -f supabase/seed_destinations.sql
   psql "$DATABASE_URL" -f supabase/seed_transit.sql
   psql "$DATABASE_URL" -f supabase/seed_places_draft.sql
   ```

   Re-applying the places seed refreshes drafts only; a verified record is never overwritten.
3. **Environment:** `cp .env.example .env.local`, then fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, from Project Settings → API keys;
   - `SUPABASE_SERVICE_ROLE_KEY`, which is **server only**: it bypasses every RLS policy;
   - a model key, or `BENTO_MAN_MOCK=1` to work without one. Without any, the chat says so and everything else works.

   Never commit `.env.local`.
4. **Auth:** add `http://localhost:3000/**` to Supabase's redirect URLs (Authentication → URL Configuration).
5. **Run:** `npm run dev`.
6. **Curation access:** sign up, then `npx tsx scripts/grant-admin.ts you@example.com`.
   - `/admin` shows "not found" to everyone else, including signed-in users, so a stranger learns nothing.
   - Admin membership can't be written over the API.
   - **Don't run this against the live project without the owner's OK.**
7. **Optional:** `npx tsx scripts/import-geography.ts` (a dry run; add `--apply`) pulls Wikidata ids and coordinates for the seeded cities. It's dry by default, because a wrong fuzzy match moves a city hundreds of kilometres.

## How to check it worked

- Sign in, create a trip, and open it. Bento Man answers, or says it has no model key.
- `npm run typecheck && npm run lint && npm test && npm run build` all pass ([commands](../30-software/commands.md)).

## How to undo it

Delete `.env.local`, or point it at another project.
