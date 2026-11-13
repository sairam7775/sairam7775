---
type: design
status: accepted
code:
  - bento/src/lib/transit/
  - bento/scripts/route.ts
  - bento/scripts/export-transit-seed.ts
last_reviewed: 2026-11-13
---

# Transit: train legs a first-timer can follow

"20 minutes" is useless to someone who has never used a Japanese station. The leg a traveller can follow reads:

> JR Nara Line from Kyoto Station, platform 8–10, 2 stops to Inari, 5 min, ¥150, IC card, no reservation — but skip the Rapid, it doesn't stop at Inari.

That last clause is the difference between a plan and a guide.

## How it works

- `bento/src/lib/transit/` is pure code: `buildGraph`, `route` and `describeRoute`.
- **A change of train costs time.** The search tracks (station, line), and a line change pays a penalty (5 minutes by default). So Kyoto → Inari stays on one Local rather than taking the Rapid one stop and changing. Walks never pay the penalty: the walk *is* the transfer.
- **Line names include the service** where it matters: "JR Nara Line · Local" and "JR Nara Line · Miyakoji Rapid" are different lines.
- **Fares are bands, not sums.** A run of hops on one operator is one ticket, priced from `fares.ts` by its total distance. An edge with an exact fare stands alone.
  - An estimated fare is shown as `~¥`.
  - A ride with no fare table, or no distance, is counted as **unpriced**, never charged ¥0 or shown as free.
- **Notes ride on the hops.** "The Rapid doesn't stop at Inari" is data on the edge, so it appears on every route that uses it.
- Travellers see train legs twice: on a route proposal (saved with it), and on each travel day of the plan, worked out again from the accepted route each time the page loads, so the two always match.

## The networks

| Network | Source in code | Built from |
|---|---|---|
| Kansai–Sanyo corridor | `seed/kansai-sanyo.ts`, the one source of truth for the corridor | Hand-built seed |
| Tokyo | `seed/tokyo.ts`: every Metro, Toei and Yamanote station, both airports, and the Shinkansen to Kyoto and Shin-Osaka | Line order and distances from ja.wikipedia's line tables; positions from Wikidata; minutes from each line's published end-to-end time |

- The tests, the CLI and `supabase/seed_transit.sql` all come from these seeds; the SQL is generated, never edited by hand.
- Tokyo's Shinkansen edges end at Kansai stations, so the graph is built from both seeds.
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
