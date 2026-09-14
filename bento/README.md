# Bento

A trip planner for people who have never been to Japan — one that gives the
honest version of every place, every train and every gap in the plan.

The design document lives at [`../docs/spec.html`](../docs/spec.html).

## What exists so far

**P1 — foundation.** Auth, the full schema with row-level security, coverage
tiers, and spend controls. You can sign in and a trip persists.

Phases P2–P8 (data spine, transit graph, the planning engine, deep curation,
Bento Man, the itinerary UI, and the booking vault) are in §13 of the spec.

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Apply the migrations** in order, either through the Supabase SQL editor
   or with the CLI:

   ```bash
   supabase link --project-ref YOUR-REF
   supabase db push
   psql "$DATABASE_URL" -f supabase/seed.sql
   ```

   `0001` is reference data, `0002` user data, `0003` row-level security and
   the verification gate, `0004` storage for uploaded bookings.

3. **Enable Google sign-in** under Authentication → Providers, and add
   `http://localhost:3000/auth/callback` to the redirect allowlist.

4. **Configure the environment:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the project URL and anon key from Project Settings → API. The
   service-role key is server-only — it bypasses every RLS policy, so it must
   never reach the browser.

5. **Run it:**

   ```bash
   npm run dev
   ```

## Commands

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Route typegen, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Two rules the code holds to

**Nothing unverified reaches a traveller.** Places carry a
`verification_status`. Factual fields (name, coordinates, station) are safe as
soon as they are imported; judgement fields — how long it really takes, when to
go, who should skip it — read as `NULL` until a human has signed the record
off. This is enforced by the `places_public` view in `0003`, not by
convention, because at ~2,000 records convention will not hold.

**The engine owns every number.** From P4, durations, fares, opening hours and
travel times come from code, not from a language model. Bento Man may never
state a fact it was not handed. A badly phrased sentence is obvious and
harmless; a silently dropped constraint looks like a working plan and strands
someone.

## Layout

```
src/
  app/
    (auth)/           sign-in, sign-up, shared form UI, auth actions
    auth/callback/    OAuth and email confirmation exchange
    trips/            trip list and creation
  lib/
    supabase/         browser, server and service-role clients
    guards/           spend cap and rate limiting
    types.ts          domain types shared with the engine
  proxy.ts            session refresh and route protection
supabase/
  migrations/         schema, RLS, storage
  seed.sql            regions, prefectures, the first cities
```
