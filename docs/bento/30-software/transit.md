---
type: design
status: accepted
code:
  - bento/src/lib/transit/
  - bento/scripts/route.ts
  - bento/scripts/export-transit-seed.ts
  - bento/src/lib/supabase/select-all.ts
last_reviewed: 2026-11-19
---

# Transit: train legs a first-timer can follow

"20 minutes" is useless to someone who has never used a Japanese station. **The goal** is a leg a traveller can follow, like this example from the spec:

> JR Nara Line from Kyoto Station, platform 8–10, 2 stops to Inari, 5 min, ¥150, IC card, no reservation — but skip the Rapid, it doesn't stop at Inari.

That last clause is the difference between a plan and a guide. **Today** a leg shows the line and service, stops, minutes, a fare (exact for intercity legs, otherwise an estimated band, `~¥`) and notes on the hops. **Platforms aren't modelled yet.**

## How it works

- `bento/src/lib/transit/` is pure code: `buildGraph`, `route` and `describeRoute`.
- **A change of train costs time.** The search tracks (station, line), and a line change pays a penalty (5 minutes by default). So Kyoto → Inari stays on one Local rather than taking the Rapid one stop and changing. Walks never pay the penalty: the walk *is* the transfer.
- **Fewer changes win, within 20 minutes of the fastest.** Travellers would rather stay on one train. So the search finds the fastest route (T minutes, penalties included), then takes the route with the fewest changes of train among those that take at most T + 20 minutes, then the fastest of those. The 20 is one constant, `FEWER_CHANGES_SLACK_MIN` in `graph.ts` (the owner's figure). So Shinjuku → Hakone-Yumoto is the direct Romancecar (85 minutes) rather than the Yamanote Line, the Shinkansen and a change (69), Asakusa → Tobu-Nikko is the direct Tobu limited express (120) rather than Ueno and the Shinkansen (110), and Tokyo → Kamakura is the direct Yokosuka Line train (60) rather than a change at Ofuna (54). A direct train more than 20 minutes slower than the fastest route loses.
  - **Only between cities.** When both stations are in the same city, the fastest route stands. Inside a city the hops are short, and 20 more minutes can double one: tried on every pair of stations in each city, a quarter of Tokyo's pairs changed and 146 took twice as long or more (Shibuya → Tochomae would go from 11 minutes with a change to 23 without). Every place's station is in the place's own city, so a day's timings (`plan_days`) don't change. A station with no city (Odawara, Utsunomiya) counts as another city. `route(…, { fewerChangesSlackMin })` overrides it either way; 0 gives the fastest route.
  - Between Kansai cities it changes station-to-station routes too, for example Kyoto → Osaka is now the direct Special Rapid (29 minutes) rather than a faster route with a change (22), and Kyoto → Kansai Airport the Haruka (80 against 76). The legs between hubs on a route proposal change only where Kamakura is one end (the direct Yokosuka Line, 6 minutes more).
  - A walk is never a change, so a route that ends with a walk between nearby stations counts as having no change (Tofukuji → Kintetsu-Nara: the JR Nara Line and a walk, 62 minutes, rather than 42 with a change).
- **Ties after that go to fewer legs.** Among routes with the same changes and minutes, the search takes the one with fewer legs (a new line or a new mode starts a leg, as it does in the route shown). Routes tied even then are settled by a fixed order of their line names and stations, so the same question always gets the same answer, whatever order the edges arrive in. So Asakusa → Shibuya is one Ginza Line ride, not the Asakusa Line and a change at Shimbashi, both 33 minutes.
- **How the search does it.** The number of changes so far is part of the search state, so the search keeps the best route to each station for each number of changes, not only the fastest. Routes come off the queue in order of (minutes, changes, legs, line order): the first to arrive is the fastest; after that only a route with fewer changes than the best so far, and no slower than T + 20, can replace it, and everything else is dropped. A route reaching a station on a line with more changes than an earlier one there is dropped too, since the earlier one was no slower. Inside a city the change count is left out of the state, so the search is the plain fastest-route search it was. A route between cities takes about 3.5 ms on the full graph, against 1.6 ms for the fastest route alone.
- **Line names include the service** where it matters: "JR Nara Line · Local" and "JR Nara Line · Miyakoji Rapid" are different lines.
- **Fares are bands, not sums.** A run of hops on one operator is one ticket, priced from `fares.ts` by its total distance. An edge with an exact fare stands alone.
  - An estimated fare is shown as `~¥`.
  - A ride with no fare table, no distance, or a distance past the end of its table is counted as **unpriced**, never charged ¥0, the last band, or shown as free.
  - On a route's legs between cities (`assessRoute`), a leg with any unpriced ride has no fare figure at all (`fareJpy: null`), so part of a fare never reads as the whole; its summary still names the part Bento knows and says a fare is missing.
- **Notes ride on the hops.** "The Rapid doesn't stop at Inari" is data on the edge, so it appears on every route that uses it. `bothWays` copies a note to the return hop, so a note that only reads right one way (where to board a bus, which train to take outbound) is given per direction instead, or left off the return.
- Travellers see train legs twice: on a route proposal (saved with it), and on each travel day of the plan, worked out again from the accepted route each time the page loads, so the two always match.

## How the graph is loaded

- **The product reads the whole graph from the database** (`bento/src/lib/transit/load.ts`, `loadGraph`), and each server instance keeps it for ten minutes.
- **It is read a page at a time.** Supabase's API answers at most 1,000 rows per request by default and drops the rest without an error, and the seed already has more than 1,000 edges. So `selectAll` (`bento/src/lib/supabase/select-all.ts`) reads each table in order of its key, 1,000 rows a request, with an exact row count, until every row has arrived. This works even if the project's row limit is set lower than 1,000.
  - If any page fails, the whole load fails and nothing is cached; a partial graph is never used.
  - If the row count changes between pages (a row added or removed mid-read), the read starts again from the first page, since the offsets have shifted. After three tries it fails rather than return a table with a row skipped or repeated.
  - The city list (`city_coverage`) and a city's places (`places_public`) are read the same way (`bento/src/lib/bento-man/store.supabase.ts`, `bento/src/lib/engine/load.ts`), and so are the admin lists (curation progress, a city's places, the review queues, backgrounds) and the trips page's check for a saved route.
- **Where a trip lands in each city** is its hub station (`CITY_HUBS` and `hubFor` in `bento/src/lib/engine/route.ts`): Tokyo Station for Tokyo, Yokohama Station for Yokohama, Kamakura Station for Kamakura, Hakone-Yumoto for Hakone, Tobu-Nikko for Nikko, the main station of each corridor city. A city with no entry lands at its station with the smallest id, the same on every load, whatever order the stations arrive in. Legs between cities on a route start and end at hubs, and Bento Man's `route_between` uses a city's hub when it is given a city rather than a station or a place.

## The networks

| Network | Source in code | Built from |
|---|---|---|
| Kansai–Sanyo corridor | `seed/kansai-sanyo.ts`, the one source of truth for the corridor | Hand-built seed |
| Tokyo | `seed/tokyo.ts`: every Metro, Toei and Yamanote station, both airports, and the Shinkansen to Kyoto and Shin-Osaka | Line order and distances from ja.wikipedia's line tables; positions from Wikidata; minutes from each line's published end-to-end time |
| Kanagawa (Yokohama and Kamakura) | `seed/kanagawa.ts`: JR Yokosuka, Tokaido and Negishi lines from Tokyo, the JR Shonan–Shinjuku Line's trains for Zushi from Shinjuku and Shibuya to Kamakura, the Tokyu Toyoko Limited Express running through onto the Minatomirai Line from Shibuya, the Blue Line to Shin-Yokohama, the Enoden from Kamakura to Enoshima and Fujisawa, and two bus stops (Jomyoji for Hokoku-ji, Honmoku for Sankeien) | Order and distances from ja.wikipedia's line tables; positions from Wikidata (the two bus stops are approximate: the position of the place each serves); minutes from published journey times, apportioned by km. JR times come from official visitor pages (Kanagawa Prefecture's Visit Kanagawa guide, Kamakura's tourist association, the temples' access pages), the larger figure where they differ; only Ofuna → Fujisawa is hand-set |
| Hakone | `seed/hakone.ts`: the Odakyu Romancecar from Shinjuku to Hakone-Yumoto, the Shinkansen (Kodama) from Tokyo and Shinagawa to Odawara, the Hakone Tozan line to Hakone-Yumoto and its mountain train to Chokoku-no-Mori and Gora, the cable car to Sounzan, both Hakone Ropeway sections (change at Owakudani) to Togendai, the Lake Ashi sightseeing ships between Togendai, Hakone-machi and Moto-Hakone, and the Tozan bus from Moto-Hakone back to Hakone-Yumoto | Km from ja.wikipedia; positions from Wikidata; minutes from the operators' pages (hakonenavi.jp), JR East's timetable (the Kodama), Odakyu, japan-guide.com, the Kanagawa Tourism Association and tabi-mag.jp, the larger where they differ (the Tozan bus is 40 minutes each way; Hakone Shrine's 60 is an outlier, not used); fares from hakonenavi.jp and Odakyu |
| Nikko | `seed/nikko.ts`: the Tobu limited express from Asakusa, the Tohoku Shinkansen from Tokyo and Ueno to Utsunomiya and the JR Nikko Line on to Nikko, the walk between the JR and Tobu stations, and the Tobu bus with four stops (Shinkyo, Tamozawa, Chuzenji Onsen, Ryuzu no taki) | Km from ja.wikipedia; positions from Wikidata (the bus stops are approximate: the position of the place each serves); minutes from JR East's timetables, Toshogu's access page, Visit Nikko and japan-guide.com, the larger where they differ; JR East by its band table, nothing else priced |

- **Every network is registered in the seed index**, `bento/src/lib/transit/seed/index.ts`. The exporter, the CLI and the seed tests read that list, and a test fails if a file in the folder is missing from it. (The place seeds have the same index, `bento/src/lib/places/seed/index.ts`.)
- **A new network is a new file**, registered in the index, with its city's hub added to `CITY_HUBS` in the same change. Edit seed files directly; don't regenerate `tokyo.ts` from the tools that first built it.
- A test checks every seed together: each station id is used once, no edge appears twice for the same stations and line, every edge ends at a known station, and each place id is used once (`bento/src/lib/transit/__tests__/all-seeds.test.ts`). This matters because `buildGraph` keeps the last station with a given id, without a warning.
- The tests, the CLI and `supabase/seed_transit.sql` all come from these seeds; the SQL is generated, never edited by hand.
- Tokyo's Shinkansen edges end at Kansai stations, so the graph is built from every seed.
- Walks carry 3 minutes of waiting, because walks never pay the transfer penalty.
- **No ODPT data.** The repo is public, and ODPT's licence forbids redistributing its data. That differs from the original spec, which planned GTFS-JP and ODPT feeds ([open questions](../00-start/open-questions.md)).
- **Known gaps:**
  - JR East rides in Tokyo and Kanagawa are priced by one band table, its trunk-line IC fares from 14 March 2026, when the cheaper Yamanote and Tokyo-area tables were folded into it. JR East's own pages refuse automated reads, so the table comes from a fare site (jr-group.jp) and published IC fares from Tokyo (sources in `fares.ts`); check it against JR East before launch. Not modelled, so a figure can be a little off: the 12 special-fare sections JR East kept after March 2026 (not named in the sources found, so a pair such as Tokyo–Yokohama may differ); JR's rule of charging the shortest route in the Tokyo area (Bento sums the km ridden); and a JR ride onto the Narita Express, which Bento prices as two tickets (slightly high). A JR ride over 100 km is unpriced.
  - The Narita Express carries its whole fare, limited express charge included (¥3,140, from Japan Guide), on its edges: one edge from Tokyo to each Narita terminal, so no part of the ride is band-priced. There is no `narita-airport` station: the airports are their terminal stations (`narita-t1`, `narita-t2-t3`, `haneda-t3`, `haneda-t1-t2`), and a Narita trip lands at `narita-t1`. A test keeps a route from each to Tokyo Station (`__tests__/airports.test.ts`).
  - Yurikamome, the Skyliner, Keikyu, the Tokyo Monorail and other private railways in Tokyo are unpriced, because the sources conflicted (Keisei's own pages give two different Skyliner fares).
  - In Kanagawa, the other operators are priced only where their own fare page could be read: the Minatomirai Line and the Enoden by band (each table matches every station pair the operator publishes; IC fares where both are published), the Blue Line ride and the Yokohama City Bus ride as exact fares on their edges. Tokyu and Keikyu Bus rides are unpriced. A Toyoko train running through onto the Minatomirai Line is one leg with two fares.
  - Kanagawa's JR minutes follow published journey times, not timetables, and JR East's own pages were not used. With them, a change at Ofuna is faster on paper than the direct Yokosuka Line train (Tokyo → Kamakura 54 against 60); the search now takes the direct train. The Tokaido leg still carries a note about the direct train for any route that changes there.
  - Where the Yokosuka and Shonan–Shinjuku lines share track (Yokohama to Kamakura), both have the same minutes, so a route may name either for those stops.
  - In Hakone, the Tozan fares (a band that holds only for Hakone-Yumoto, Chokoku-no-Mori and Gora, and exact fares from Odawara and on the cable car), the ropeway's flat fare, the ships and the Tozan bus are priced; the Shinkansen to Odawara is not (JR Central has no table). Odawara → Gora is priced ¥820 against a through fare of ¥770, because the Odawara ride's exact fare stands alone. The ships run a loop with one fare however far you ride, so each through ride is its own hop, and the short Hakone-machi–Moto-Hakone crossing has its own line name so a through ride is never priced as two.
  - In Nikko only the JR Nikko Line is priced: it is a local line (地方交通線) on JR East's dearer local-line table, so it carries an exact fare (¥803 IC, Utsunomiya – Nikko) rather than a trunk-line band; a station added on it needs its own exact fare. The Shinkansen to Utsunomiya is past the band table's 100 km, so it is unpriced. Tobu's limited express charge depends on the train and the day, and Tobu Bus's fare table could not be read, so both are unpriced. There is no Tokyo–Ueno Shinkansen hop: a 5-minute ride there would pull Tokyo routes (Narita to Tokyo, for one) onto it.
  - The search doesn't weigh fares: between two routes it never prefers the cheaper one (the direct Romancecar happens to be priced, ¥2,470, where the Shinkansen route to Hakone-Yumoto is partly unpriced).
  - Not modelled for Hakone and Nikko: the Odakyu express (non-Romancecar) trains, the JR Tokaido Line to Odawara, other Tozan bus lines (Gora to the Pola Museum is the museum's free shuttle), the Izuhakone side of Lake Ashi, the World Heritage loop bus and the Nishisando stop in Nikko, and Yumoto Onsen beyond Ryuzu.
  - Not modelled in Kanagawa: the Shonan–Shinjuku Line's trains for Odawara, the Keikyu Line, the Shinkansen and the Tokyu Shin-Yokohama Line to Shin-Yokohama, the Odakyu Line and the Shonan Monorail to Enoshima, and walks between nearby stations in Yokohama.

## Try it

```bash
npx tsx scripts/route.ts kyoto inari     # a route over the seed, no database needed
npx tsx scripts/route.ts --stations
```

`GET /api/transit?from=kyoto&to=inari` returns a route over the database graph (signed-in only).

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Transit (P3)". Source: spec §07 ("Transit legs are described, not timed"), §09; `bento/README.md` "Transit".
