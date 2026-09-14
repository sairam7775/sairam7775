# Bento

A trip planner for people who have never been to Japan — one that gives the
honest version of every place, every train and every gap in the plan.

The design document lives at [`../docs/spec.html`](../docs/spec.html).

## What exists so far

**P1 — foundation.** Auth, the full schema with row-level security, coverage
tiers, and spend controls. You can sign in and a trip persists.

**P2 — data spine.** All of Japan seeded at stub tier: 9 regions, 47
prefectures, 99 destinations. Plus the curation UI at `/admin` — coverage
tiers, the place editor, and the verification workflow that decides what a
traveller is allowed to see.

**P3 — transit graph.** A routing engine over stations and edges (Dijkstra
on station × line, so a change of train is charged as a transfer), fares
from per-operator distance bands, and a GTFS importer. The Kansai–Sanyo
corridor is hand-seeded so the four deep cities route today.

Phases P4–P8 (the planning engine, deep curation, Bento Man, the itinerary
UI, and the booking vault) are in §13 of the spec.

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

6. **Grant yourself curation access.** Sign up first, then:

   ```bash
   npx tsx scripts/grant-admin.ts you@example.com
   ```

   `/admin` 404s for everyone else — including signed-in users — so a
   stranger learns nothing about whether the route exists. Membership is not
   writable over the API by design: no RLS policy permits an insert, so
   there is no "make me an admin" request to find.

7. **Enrich the geography** (optional, needs network):

   ```bash
   npx tsx scripts/import-geography.ts          # dry run
   npx tsx scripts/import-geography.ts --apply
   ```

   Pulls Wikidata ids and coordinates for the seeded cities. Dry run is the
   default because label matching is fuzzy, and a wrong match silently moves
   a city hundreds of kilometres — corrupting every travel-time estimate
   built on top of it.

## Commands

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Route typegen, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## Transit

```bash
npx tsx scripts/route.ts kyoto inari          # route over the hand seed, no DB
npx tsx scripts/route.ts --stations
npx tsx scripts/export-transit-seed.ts > supabase/seed_transit.sql
npx tsx scripts/import-gtfs.ts ./feeds/odpt --prefix odpt   # dry run; --apply to write
```

Three things the engine does that a naive graph would not:

- **A change of train costs time.** Search state is (station, line), so
  Kyoto → Inari stays on one Local rather than taking the Rapid one stop
  and changing — even though the Rapid is faster to Tofukuji.
- **Fares are bands, not sums.** A run of hops on one operator is one
  ticket: Kyoto → Inari is 2.7 km in the ¥150 band, not two ¥150 hops.
  Intercity legs carry exact fares; everything else is marked `estimate`
  and shown to the traveller as `~¥`.
- **Notes ride on edges.** "The Rapid does not stop at Inari" is data on the
  hop, so it surfaces on any route that uses it.

GTFS-JP and ODPT feeds are downloads this repo's CI cannot reach, so the
importer runs locally against an unzipped feed. It dry-runs by default and
flags edges over 90 minutes — a bad `stop_sequence` produces absurd
minutes, and absurd minutes corrupt every itinerary built on them.

`GET /api/transit?from=kyoto&to=inari` returns a route over the database
graph, signed-in only.

## Logo

A bento box, four compartments, one umeboshi — a Hinomaru bento. The
masters are SVG; everything raster is rendered from them.

| File | Use |
|---|---|
| `public/logo/bento-mark.svg` | The mark, dark lines, transparent — on light backgrounds |
| `public/logo/bento-mark-light.svg` | Rice-white lines — on dark backgrounds |
| `public/logo/bento-app-icon.svg` | Filled lacquer tile — tabs, home screens, anywhere small |
| `public/logo/bento-wordmark.svg` | "Bento" in Bricolage Grotesque 800, outlined to paths |
| `public/logo/bento-lockup.svg` / `-light.svg` | Mark + wordmark, dark and light |
| `public/logo/bento-loader.svg` / `-light.svg` | The loader — the umeboshi hops between compartments; self-contained CSS |
| `src/components/logo.tsx` | `<BentoMark>` and `<BentoLogo>` for the app itself |
| `src/components/loading.tsx` | `<BentoLoader>` and `<PageLoader>`; wired into `src/app/loading.tsx` for route transitions |

Platform files are generated, not hand-made: `src/app/icon.svg`,
`favicon.ico`, `apple-icon.png` and `opengraph-image.png` follow Next.js
file conventions and are picked up automatically; `public/icons/` holds the
PWA set that `src/app/manifest.ts` points at, including maskable variants
with the mark inside the central 80% safe zone.

```bash
node scripts/build-wordmark.mjs   # re-outline the wordmark from the font
node scripts/render-icons.mjs     # re-render every PNG from the masters
```

Colours: lacquer `#221C1E`, rice `#FBF8F3`, salmon `#FF7757`.

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
  app/
    admin/            curation: tiers, place editor, verification
  lib/
    admin.ts          the curation gate
    transit/          graph, router, fares, GTFS parser, corridor seed
scripts/
  grant-admin.ts      grant or revoke curation access
  import-geography.ts Wikidata enrichment for seeded cities
supabase/
  migrations/         schema, RLS, storage, curation
  seed.sql            regions and all 47 prefectures
  seed_destinations.sql  99 destinations at stub tier
```

## Coverage tiers

Every city in Japan exists in the database from day one. What differs is how
much we can honestly claim to know:

| Tier | Means | Planner behaviour |
|---|---|---|
| `deep` | 25+ verified places | Builds whole day itineraries |
| `outline` | 8+ verified places | Suggests places, won't claim a day is complete |
| `stub` | Name and location only | Says plainly it doesn't know this place well enough |

The tier is enforced, not advisory: `/admin` refuses to promote a city that
does not have the verified places to back it up. The alternative is silent
thinness — a Takayama itinerary that looks exactly like the Kyoto one but is
built from four records and a guess, which is invisible until someone is
standing in Takayama with a bad plan.
