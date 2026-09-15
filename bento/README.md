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

**P4 — the engine.** The recommender and day scheduler as pure TypeScript:
Fig. 1's scoring with a reason clause per term, and Fig. 2's seven steps —
budget, filter, anchor, grow, order, time, validate. Every item carries the
terms that put it there; every place left out carries the rule or term that
removed it.

**P5 — deep data.** The first draft batch for the corridor: 134 place
records across Kyoto, Osaka, Nara, Hiroshima, Miyajima and Himeji, each at
the full Fig. 3 shape — three durations, a quiet window, a crowd note, a
tip, who should skip it, cost, hours, conflicts and pairings, seasons, and
where to check. Every one is a draft: the verification gate hides its
judgement until a human signs it off in `/admin/review`.

**P6 — Bento Man.** The conversation, over reasoning that already works.
Claude Opus 5 with nine tools that call the engine and the store; it does
intent and prose, the engine does every number. Onboarding in a handful
of questions, route proposals that refuse over-packed trips with the
arithmetic shown, day plans and changes as proposals the traveller accepts
or rejects (§08). Plus the eval set the D8 model test runs against.

**P7 — the itinerary UI.** A day is a bento box: a lacquer frame holding
one compartment per stop, sized to the time the stop takes, with the
train between them written on the frame. An over-packed day spills past
the line where the day's budget ends before you read a word. Drag to
reorder, pin, remove — the traveller's edits apply at once and the engine
re-times the day; "re-plan this day" asks the engine to choose again
around the pins and comes back as a proposal. The app moved to the
bento palette and self-hosted fonts.

Phase P8 (the booking vault and gap detection) is in §13 of the spec.

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
   the verification gate, `0004` storage for uploaded bookings, `0005`–`0008`
   hardening, curation progress and seasons, `0009` proposal status and the
   traveller-safe coverage view. Then the seeds, in this order:

   ```bash
   psql "$DATABASE_URL" -f supabase/seed_destinations.sql
   psql "$DATABASE_URL" -f supabase/seed_transit.sql
   psql "$DATABASE_URL" -f supabase/seed_places_draft.sql
   ```

   Places reference stations, so transit goes in first. Re-applying the
   places seed refreshes drafts only — a record you have verified is never
   overwritten by a re-export.

3. **Enable Google sign-in** under Authentication → Providers, and add
   `http://localhost:3000/auth/callback` to the redirect allowlist.

4. **Configure the environment:**

   ```bash
   cp .env.example .env.local
   ```

   Fill in the project URL and anon key from Project Settings → API. The
   service-role key is server-only — it bypasses every RLS policy, so it must
   never reach the browser. `ANTHROPIC_API_KEY` turns Bento Man on;
   without it the chat says so and everything else still works.

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

## Curation

```bash
npx tsx scripts/export-places-seed.ts > supabase/seed_places_draft.sql
```

The drafts live in `src/lib/places/seed/*.ts`, one file per city, and the
SQL is generated from them — edit the TypeScript, never the SQL. The
exporter refuses duplicate ids and any `conflicts`/`pairs` that point at a
record that does not exist, because a dangling link is a silent no-op in
the engine.

Signing off is done in `/admin/review`: one draft at a time, every field on
screen, one button to verify and one to skip. What to check per record is
in spec §10 — the durations against your own sense of the place, the hours
and cost against the source listed, the tip for anything that is not true.
A record that needs a change goes through the editor first, then back to
the queue.

Deep tier needs 25 verified places (§10); the batch is sized so each of
the four deep cities can get there:

| City | Drafts |
|---|---|
| Kyoto | 41 |
| Osaka | 28 |
| Nara | 26 |
| Hiroshima | 25 |
| Miyajima | 8 |
| Himeji | 6 |

Once a city clears the bar, promote it on its `/admin/cities` page. The
planner will not build a day anywhere still at stub tier, however many
records it has.

## The day view

`/trips/<id>?day=YYYY-MM-DD`. The strip across the top is every date of
the accepted route; the bar under each is how full that day is. The open
box is the selected day.

Three kinds of change, and who makes them:

| Change | Who decides | What happens |
|---|---|---|
| Drag, ↑ ↓, pin, unpin, remove | The traveller | Applied at once. `retimeDay` runs the clock through the new order with real legs, inserts lunch in the first gap, and says if the day no longer fits. |
| Re-plan this day | The engine | `planDay` chooses again around what is pinned. Comes back as a proposal in the conversation. |
| Anything Bento Man is asked | The engine, narrated by the model | Also a proposal. |

Compartment height is time (about a pixel a minute), so a 3-hour stop is
a tall tile and a 15-minute one is a short one. The dashed salmon line is
where the day's budget for that pace runs out; tiles past it carry an
"over" mark and the ring in the side compartment turns red.

## Bento Man

Open a trip at `/trips/<id>` and the right-hand panel is the conversation.
What it can do is exactly what its tools can do, and every tool is a call
into the engine or the store — the model never touches the itinerary:

| Tool | Does |
|---|---|
| `set_preferences`, `set_trip_dates` | Onboarding answers, saved where the traveller can read and correct them |
| `assess_route` | Cities and nights → tier per city, train time per leg, share of the trip spent moving, and a verdict with the arithmetic |
| `suggest_route` | The corridor's starting route for the trip length |
| `propose_route` | A route as a proposal |
| `plan_days` | Day plans from the engine as a proposal — every empty day, or named dates, or a day trip |
| `replan_day` | Pin, unpin, remove, add, avoid a category, start later — the engine re-plans around what is kept |
| `get_place`, `route_between` | The verified facts and the journey, so a description quotes the record rather than the model's memory |

A proposal is a diff: the day as it would be next to the day as it is,
each stop flagged kept, new, moved or out, with what was left out and why.
It sits on the assistant message with a status, and `acceptProposal`
applies it in one request — the only path by which a plan changes.

Guards, in order: sign-in, a per-user throttle, the monthly spend cap,
then the model. Every turn records its tokens and cost against the user.

```bash
BENTO_MAN_MODEL=claude-opus-5     # default
BENTO_MAN_EFFORT=medium           # low | medium | high
```

### The eval set

`src/lib/bento-man/evals/scenarios.ts` holds ~30 planning scenarios with
known-correct answers: onboarding, over-packed routes, stub cities, day
plans, changes that must not regenerate the rest, facts that must come
from the database, and the voice. Each is graded mechanically — tools
called or not called, prose patterns, proposal kind, and the voice lint —
so a prompt edit or a model swap fails loudly.

```bash
npx tsx scripts/eval-bento-man.ts                           # Opus 5
npx tsx scripts/eval-bento-man.ts --model claude-sonnet-5   # the D8 test
npx tsx scripts/eval-bento-man.ts --only route-overpacked --out evals/run.json
```

It runs the real model against the in-memory store (the drafted corridor
treated as verified, no database), so it needs `ANTHROPIC_API_KEY` and a
network. Expect a few cents per run at medium effort with caching. The
engine-side half of every scenario is also a Vitest test and runs offline.

## Commands

| | |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Route typegen, then `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Vitest |

## The engine

```bash
npx tsx scripts/plan-day.ts                              # Wed 25 Nov, the owner profile
npx tsx scripts/plan-day.ts 2026-11-23                   # a Monday — the museum drops out
npx tsx scripts/plan-day.ts 2026-11-25 --pin kyt-sanjusangendo@10:00
```

`planDay` takes a city's places (through the verification gate), the
traveller, and a travel function (the P3 router), and returns a `DayPlan`:
timed items with a reason each, meals, budget and slack, per-day cost, and
`considered` — everything left out, with the term that removed it.
`planTrip` runs days in sequence so a place is never reused and totals cost
per city.

What it will not do, by design: plan on a draft (its durations are hidden),
put two `conflicts_with` places in one day, fill a Monday with something
closed on Mondays, rank a place the traveller excluded, or invent a travel
time — when the graph has no route it assumes 45 minutes and says so.

Weights in `src/lib/engine/score.ts` are configuration, not constants, and
are the first thing to tune once the eval set exists (spec §17).

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
    trips/            trip list and creation; trips/[id] is the day view and the chat
    api/chat/         one streamed turn with Bento Man
  lib/
    supabase/         browser, server and service-role clients
    guards/           spend cap and rate limiting
    types.ts          domain types shared with the engine
  proxy.ts            session refresh and route protection
  app/
    admin/            curation: tiers, place editor, verification
  lib/
    admin.ts          the curation gate
    bento-man/        prompt, tools, diff model, stores, the chat loop, evals
    engine/           scoring, filters, scheduler, route assessor, re-timer, fixtures
    places/seed/      the drafted place records, one file per city
    transit/          graph, router, fares, GTFS parser, corridor seed
scripts/
  grant-admin.ts      grant or revoke curation access
  import-geography.ts Wikidata enrichment for seeded cities
  eval-bento-man.ts   the eval set against a model
  export-places-seed.ts  drafts → supabase/seed_places_draft.sql
  export-transit-seed.ts corridor → supabase/seed_transit.sql
supabase/
  migrations/         schema, RLS, storage, curation, seasons
  seed.sql            regions and all 47 prefectures
  seed_destinations.sql  99 destinations at stub tier
  seed_transit.sql    46 stations, 132 directed edges (generated)
  seed_places_draft.sql  134 drafted places (generated)
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
