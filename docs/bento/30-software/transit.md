---
type: design
status: accepted
code:
  - bento/src/lib/transit/
  - bento/scripts/route.ts
  - bento/scripts/export-transit-seed.ts
  - bento/src/lib/supabase/select-all.ts
last_reviewed: 2026-11-15
---

# Transit: train legs a first-timer can follow

"20 minutes" is useless to someone who has never used a Japanese station. **The goal** is a leg a traveller can follow, like this example from the spec:

> JR Nara Line from Kyoto Station, platform 8–10, 2 stops to Inari, 5 min, ¥150, IC card, no reservation — but skip the Rapid, it doesn't stop at Inari.

That last clause is the difference between a plan and a guide. **Today** a leg shows the line and service, stops, minutes, a fare (exact for intercity legs, otherwise an estimated band, `~¥`) and notes on the hops. **Platforms aren't modelled yet.**

## How it works

- `bento/src/lib/transit/` is pure code: `buildGraph`, `route` and `describeRoute`.
- **A change of train costs time.** The search tracks (station, line), and a line change pays a penalty (5 minutes by default). So Kyoto → Inari stays on one Local rather than taking the Rapid one stop and changing. Walks never pay the penalty: the walk *is* the transfer.
- **Line names include the service** where it matters: "JR Nara Line · Local" and "JR Nara Line · Miyakoji Rapid" are different lines.
- **Fares are bands, not sums.** A run of hops on one operator is one ticket, priced from `fares.ts` by its total distance. An edge with an exact fare stands alone.
  - An estimated fare is shown as `~¥`.
  - A ride with no fare table, or no distance, is counted as **unpriced**, never charged ¥0 or shown as free.
- **Notes ride on the hops.** "The Rapid doesn't stop at Inari" is data on the edge, so it appears on every route that uses it.
- Travellers see train legs twice: on a route proposal (saved with it), and on each travel day of the plan, worked out again from the accepted route each time the page loads, so the two always match.

## How the graph is loaded

- **The product reads the whole graph from the database** (`bento/src/lib/transit/load.ts`, `loadGraph`), and each server instance keeps it for ten minutes.
- **It is read a page at a time.** Supabase's API answers at most 1,000 rows per request by default and drops the rest without an error, and the seed already has more than 1,000 edges. So `selectAll` (`bento/src/lib/supabase/select-all.ts`) reads each table in order of its key, 1,000 rows a request, with an exact row count, until every row has arrived. This works even if the project's row limit is set lower than 1,000.
  - If any page fails, the whole load fails and nothing is cached; a partial graph is never used.
  - If the row count changes between pages (a row added or removed mid-read), the read starts again from the first page, since the offsets have shifted. After three tries it fails rather than return a table with a row skipped or repeated.
  - The city list (`city_coverage`) and a city's places (`places_public`) are read the same way (`bento/src/lib/bento-man/store.supabase.ts`, `bento/src/lib/engine/load.ts`), and so are the admin lists (curation progress, a city's places, the review queues, backgrounds) and the trips page's check for a saved route.
- **Where a trip lands in each city** is its hub station (`CITY_HUBS` and `hubFor` in `bento/src/lib/engine/route.ts`): Tokyo Station for Tokyo, the main station of each corridor city. A city with no entry lands at its station with the smallest id, the same on every load, whatever order the stations arrive in. Legs between cities on a route start and end at hubs, and Bento Man's `route_between` uses a city's hub when it is given a city rather than a station or a place.

## The networks

| Network | Source in code | Built from |
|---|---|---|
| Kansai–Sanyo corridor | `seed/kansai-sanyo.ts`, the one source of truth for the corridor | Hand-built seed |
| Tokyo | `seed/tokyo.ts`: every Metro, Toei and Yamanote station, both airports, and the Shinkansen to Kyoto and Shin-Osaka | Line order and distances from ja.wikipedia's line tables; positions from Wikidata; minutes from each line's published end-to-end time |

- **Every network is registered in the seed index**, `bento/src/lib/transit/seed/index.ts`. The exporter, the CLI and the seed tests read that list, and a test fails if a file in the folder is missing from it. (The place seeds have the same index, `bento/src/lib/places/seed/index.ts`.)
- **A new network is a new file**, registered in the index, with its city's hub added to `CITY_HUBS` in the same change. Edit seed files directly; don't regenerate `tokyo.ts` from the tools that first built it.
- A test checks every seed together: each station id is used once, no edge appears twice for the same stations and line, every edge ends at a known station, and each place id is used once (`bento/src/lib/transit/__tests__/all-seeds.test.ts`). This matters because `buildGraph` keeps the last station with a given id, without a warning.
- The tests, the CLI and `supabase/seed_transit.sql` all come from these seeds; the SQL is generated, never edited by hand.
- Tokyo's Shinkansen edges end at Kansai stations, so the graph is built from every seed.
- Walks carry 3 minutes of waiting, because walks never pay the transfer penalty.
- **No ODPT data.** The repo is public, and ODPT's licence forbids redistributing its data. That differs from the original spec, which planned GTFS-JP and ODPT feeds ([open questions](../00-start/open-questions.md)).
- **Known gaps:**
  - JR East has no fare table yet, so JR rides in Tokyo are unpriced;
  - Yurikamome, airport lines and private railways in Tokyo are unpriced too, because the sources conflicted.

## Try it

```bash
npx tsx scripts/route.ts kyoto inari     # a route over the seed, no database needed
npx tsx scripts/route.ts --stations
```

`GET /api/transit?from=kyoto&to=inari` returns a route over the database graph (signed-in only).

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Transit (P3)". Source: spec §07 ("Transit legs are described, not timed"), §09; `bento/README.md` "Transit".
