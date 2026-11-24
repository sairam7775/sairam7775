---
type: overview
status: draft
last_reviewed: 2026-11-21
---

# Ready-made trips: the phased plan

A plan any agent can pick up. It covers what to build, in what order, and how to tell each piece is done. Facts are as of 17 November 2026 (main at `517e56e`); check them again before starting a package.

## The idea

A traveller picks a trip length, from one day to two weeks, and gets a popular, checked trip they can accept and then change. Place data is added in the order those trips need it, not city by city.

This does not change the target in [D2](../70-decisions/d02-whole-japan.md) (all of Japan). It changes the order: the most-visited destinations first, each one finished to the point where a ready-made trip can use it.

**Why this order**

- Most visitors go to the same 15 to 20 destinations, so about 150 to 250 places serve most trips. The city-by-city plan needed about 950.
- A new traveller gets a good trip in one step, with no model call and no cost.
- A trip can be checked once from end to end: order, train times, closing days.

**What it costs**

- A traveller who asks for somewhere outside the set still gets the honest "I don't know it well enough yet" answer ([coverage](../10-product/coverage.md)).
- Each trip is one more thing to keep true as hours and prices change.

## The one design rule

**A ready-made trip is saved input to the planner. It is never a hand-written itinerary.**

A trip stores its cities, nights, day trips and a few must-see places per day. The engine ([engine](../30-software/engine.md)) builds the actual days from that, for the traveller's dates, pace and party. So:

- The trip follows closing days and seasons for the real dates.
- It stays editable with the tools the traveller already has (re-plan a day, pin, remove).
- When a place's hours change, every trip that uses it is right again without an edit.
- Times, fares and durations still come only from the engine. No trip file states one.

## Where things stand

| City | Tier on live | Places (verified) | Stations | What it needs before a trip can use it |
|---|---|---|---|---|
| Kyoto | deep | 41 (41) | 26 | Nothing |
| Osaka | deep | 28 (28) | 13 | Nothing |
| Nara | deep | 26 (26) | 5 | Nothing |
| Hiroshima | deep | 25 (25) | 8 | Nothing |
| Tokyo | stub | 57 (57) | 257 | Owner promotes it at `/admin/cities` |
| Miyajima | stub | 8 (8) | 2 | Owner promotes it (8 verified reaches outline) |
| Himeji | stub | 6 (6) | 2 | Two more verified places, then promotion. Outline needs 8 |
| Kamakura | stub | 13 (0) | 6 | Owner signs off the drafts at `/admin/review`, then promotes |
| Yokohama | stub | 12 (0) | 12 | Same |

Other facts a builder needs:

- **Trains between these cities exist** in the seed: Tokyo to Kyoto, Osaka to Hiroshima (the JR Kyoto Line to Shin-Osaka, then the Shinkansen), Kyoto and Osaka to Nara, Hiroshima to Miyajima, Tokyo to Kamakura and Yokohama, Kansai Airport to Osaka and Kyoto. Check with `npx tsx scripts/route.ts <from> <to>`.
- **Airports:** the station ids are `narita-t1`, `narita-t2-t3`, `haneda-t1-t2` and `haneda-t3` (there is no `narita-airport`). Routes from all four into Tokyo exist. Tokyo to Kamakura and Yokohama had no fare (package 1A adds them).
- **A planner refuses a stub city.** A trip that includes one would fail, so every city in a published trip must be outline or deep on live.
- **Today's route suggestion** is a fixed table for the Kansai–Sanyo corridor only (`suggestRoute` in `bento/src/lib/engine/route.ts`). Ready-made trips replace it in Phase 1.
- **Starting a trip today** goes through a short form (`bento/src/lib/trips/guided-start.ts`, `bento/src/app/trips/plan/`) and then the chat.
- **Day trips work:** a zero-night city on the route is a day trip or an en-route stop (`allocateDates`), and `plan_days` plans a day in another city.
- **An outline city's day** carries the line "Planned from the main sights here." That is correct for a ready-made trip too; don't hide it.

## Rules for every package

These are the workspace standards (`knowledge/AI-DEVELOPMENT.md`). In short:

1. One package, one branch, one pull request. Write the failing test first.
2. The builder never reviews its own change. A different model reviews it, and someone runs it for real.
3. Say what was not tested.
4. Any change to Bento Man's prompt, tool descriptions or tool results needs a live evaluation against the current prompt ([Bento Man (software)](../30-software/bento-man.md)).
5. Ask the owner before a push, merge, deploy or live database change.
6. Place data follows [curation](../50-operations/curation.md): drafts are hidden until the owner signs them off. Only the owner verifies places and promotes cities.
7. Update the docs notes the change touches, in the same pull request.

## Phase 1: ready-made trips on the cities Bento already has

**Goal:** a traveller can start a checked trip of 1, 2, 3, 5, 7, 10 or 14 days across the nine cities above, without using the chat.

**Owner work in this phase:** promote Tokyo and Miyajima; sign off 25 drafts (Kamakura, Yokohama) and 2 new Himeji places; promote those three cities; approve the trip list in 1B.

### 1A. Finish the nine cities' data

- Add two Himeji places (draft, fact-check, seed file `bento/src/lib/places/seed/himeji.ts`), so it can reach outline.
- Pin routes from all four airport terminals into Tokyo with a test (the ids are above). Add fares where they are missing.
- Add fares for Tokyo to Kamakura and Tokyo to Yokohama ([transit](../30-software/transit.md)).
- **Done when:** on live, all nine cities are outline or deep; `route.ts` returns a route between every pair of neighbouring cities used in 1B and from each arrival airport; the all-seeds tests pass.

### 1B. The trip format and the first trips

- New folder `bento/src/lib/trips/ready-made/`: a type, one file per trip, and an index, in the style of the place seeds.
- A trip holds: id, title, one-line summary, number of days, the cities with nights and a reason each (the shape `propose_route` already takes), day trips, and up to three must-see place ids per day. Text a traveller reads goes in `bento/src/copy/en.ts`.
- **Tests that every trip must pass,** run against the seeds:
  - every city and place id exists, and no city is one the planner would refuse;
  - `assessRoute` does not call the route overpacked;
  - `planTrip` fills every day, and every must-see place is in the plan, for a start on each day of the week and in each season;
  - no two must-see places on one day conflict (pins skip the conflict check, so the test must catch it);
  - the nights add up to the trip's length.
- **The first trips** (a proposal: the owner edits and approves this list before any are written):

| Days | Trips |
|---|---|
| 1 | Tokyo highlights; Kyoto east side; Kyoto Arashiyama; Osaka; Nara; Kamakura; Yokohama; Miyajima from Hiroshima |
| 2 | Tokyo; Kyoto |
| 3 | Tokyo with Kamakura; Kyoto with Nara |
| 5 | Tokyo, Kamakura and Yokohama; Osaka, Kyoto and Nara |
| 7 | Tokyo, Kyoto, Osaka (the classic first visit); Osaka, Kyoto, Nara, Himeji, Hiroshima |
| 10 | Tokyo, Kyoto, Nara, Osaka, Hiroshima, Miyajima |
| 14 | All nine cities, at an easy pace |

- **Done when:** the tests above pass for every trip in the approved list, and a different model has read each trip for sense (does the order suit a first-time visitor?).

### 1C. Starting a trip from a ready-made one

- A picker on the plan page (`bento/src/app/trips/plan/`): choose a length, see the trips for it, pick one, give a start date and the number of people.
- A server action creates the trip, saves the route, and has the engine plan the days with the must-see places kept.
- Reuse the existing save path for routes and days (the proposal functions in the database). Don't add a second way to write an itinerary.
- A start date is required: the engine needs real dates for closing days.
- **Done when:** a signed-in traveller can start the 7-day trip and the 1-day trip in a real browser, sees full days, and can re-plan one day; nothing calls the model; the trip counts against the same limits as any other trip.
- **Decided by the owner (20 Nov):** the plan page has two tabs at the top, "Plan your own" (the form, first and the default) and "Ready-made trips" (`?tab=ready-made`). With no ready-made trip to offer, there are no tabs, only the form.
- **Changed by the owner (22 Nov):** the blank-trip form moved from the trips list to a third tab, "Blank trip" (`?tab=blank`). With no ready-made trip to offer, the page shows the two other tabs, the form and the blank trip.

### 1D. Bento Man knows the ready-made trips

- `suggest_route` returns the matching ready-made trip in place of the corridor table, so the chat and the picker agree.
- This changes a tool result, so it needs a live evaluation before and after (rule 4). Add eval scenarios: "I have a week, first time in Japan" and "two weeks, what do you suggest".
- **Done when:** the evaluation shows no drop on existing scenarios and the new ones pass.

### 1E. Read-through on the live site

- After 1A to 1D are merged and the owner's sign-offs are done: start every published trip on the live site with a temporary account (the owner's OK is needed for the account), read each day, and list anything odd.
- **Done when:** the list is empty or each item has a fix or the owner's acceptance.

## Phase 2: the classic route, complete

**Goal:** the places almost every two-week first visit adds to the nine cities.

- **Destinations:** Hakone, Mount Fuji (Kawaguchiko), Nikko, Kanazawa, Takayama, Shirakawa-go, Koyasan, Kobe. About 8 to 12 places each, so about 80 to 100 new places (an estimate).
- **Transit to add:** the Hokuriku Shinkansen to Kanazawa, the lines to Hakone, Nikko and Kawaguchiko, the Takayama line, the Koyasan line and cable car. Shirakawa-go is reached only by bus: check that a bus leg works as an edge the way the Miyajima ferry does, before drafting its places.
- **New trips:** day trips from Tokyo (Nikko, Hakone, Fuji); 7 days with Hakone; 10 and 14 days through Kanazawa and Takayama; a 14-day trip that ends in Osaka for a flight home from Kansai.
- **Order:** one destination at a time, each as its own run of 1A-style data work, then the trips that use it. Hakone and Nikko first: their drafts were already planned.
- **Done when:** each destination is outline or deep on live and every new trip passes the 1B tests and a live read-through.

## Phase 3: the regions

**Goal:** one self-contained trip for each region a visitor flies or rides into, and longer trips that combine one region with the classic route.

| Region | Destinations | Note |
|---|---|---|
| Kyushu | Fukuoka, Dazaifu, Nagasaki, Kumamoto, Beppu and Yufuin, Kagoshima | The Sanyo Shinkansen already reaches Hiroshima; extend it to Hakata |
| Hokkaido | Sapporo, Otaru, Hakodate, Furano and Biei, Noboribetsu | Most visitors fly in |
| Setouchi and Shikoku | Okayama, Kurashiki, Naoshima, Takamatsu, Matsuyama, Onomichi | Ferries matter here |
| Tohoku | Sendai, Matsushima, Hiraizumi, Aomori, Kakunodate | |
| Okinawa | Naha, the main-island sights, one outer island | No rail beyond the Naha monorail |

- **A design question to settle first:** the transit graph has trains, a ferry and no flights. A trip that includes Hokkaido or Okinawa needs a flight leg between cities. Decide how a flight is stored and shown before starting those two regions. Car travel (common in Hokkaido and Okinawa) is a second question: say plainly where Bento assumes public transport.
- **Order:** Kyushu first (rail only, and Fukuoka and Dazaifu were already planned), then Setouchi, then Hokkaido, Tohoku and Okinawa.
- About 25 destinations at 8 to 10 places, so about 200 to 250 places (an estimate).
- **Done when:** as Phase 2, per region.

## Phase 4: seasons, themes and upkeep

- **Seasonal trips:** cherry blossom, autumn leaves, winter snow, summer festivals. A place already has `seasons`; a trip gains "best in" months and the picker shows the ones that suit the traveller's dates.
- **Themed trips:** with children, food, gardens and temples, a slower pace. These are mostly new must-see lists over places Bento already has.
- **Upkeep:** a re-check queue ordered by how many ready-made trips use a place, so the most-used facts are checked most often (stage 4 of [curation](../50-operations/curation.md)).
- **Fares and passes:** fill in the missing JR fares, then tell the traveller whether a rail pass pays for their trip. Advice about money needs exact fares first.

## Phase 5: the rest of Japan, led by demand

- Record which cities travellers ask for and Bento has to refuse (a count per city, with no personal data).
- Bring those to outline (8 verified places) in the order of the count, with the same data steps.
- This is how the remaining cities on the list of 99 get done: by what travellers ask for, not by the alphabet.

## How much work this is

| Phase | New places (estimate) | New trips | Owner sign-off |
|---|---|---|---|
| 1 | 2, plus 25 drafts already loaded | about 17 | 27 places, 5 promotions, the trip list |
| 2 | 80 to 100 | about 8 | 80 to 100 places |
| 3 | 200 to 250 | about 10 | 200 to 250 places |
| 4 | few | about 10 | the trip lists |
| 5 | open-ended | none | by demand |

The place counts are estimates from 8 to 12 places per destination. The pace is set by two things: how many places the owner can sign off in a week, and how many drafts the drafting models can produce. Neither has been measured for this plan.

## Not decided yet

1. The Phase 1 trip list (1B): the owner edits and approves it.
2. ~~Where the picker sits for a new traveller (1C).~~ Decided: beside the current form.
3. Whether a signed-out visitor can read a ready-made trip before making an account. It would help people find Bento, and it needs its own design.
4. How a flight between cities is stored and shown (Phase 3).
5. Which models may draft places, beyond the current recipe.

## Picking this up

1. Read `bento/CLAUDE.md`, the knowledge base (`../knowledge/GUIDE.md`, `AI-DEVELOPMENT.md`) and this note.
2. Check "Where things stand" against the live database and main. Update the table if it has moved.
3. Take the first package that isn't done, in order. Phase 1 packages depend on each other as written: 1A and 1B can run side by side; 1C needs 1B; 1D needs 1B; 1E needs all four.
4. When a package is done, mark it here with the pull request number and the date.

## Progress

| Package | Status | Pull request |
|---|---|---|
| 1A | Done 18 Nov 2026 (Himeji drafts, JR East fares, airport route tests) | #90, #91 |
| 1B | Built and reviewed; waits for a live Bento Man evaluation | |
| 1C | Built 19 Nov 2026: the picker sits beside the form (the owner's choice); trips through a city that isn't planned on live are hidden. Waits for review and a signed-in run in a real browser | |
| 1D | Built 20 Nov 2026: `suggest_route` offers the picker's trips for the length (N nights is N + 1 days; N days, one night shorter, only for nights given without trip dates), corridor table otherwise; three new eval scenarios, graded on route content. Waits for review and the live evaluation before and after. 21 Nov 2026 (the owner's call): a start that puts a must-see on a day it is closed is refused by the picker, naming each closed must-see and the nearest start that works (today: six trips over the year-end break, through Osaka Castle and the Peace Memorial Museum; the list is in engine.md). 23 Nov 2026 (the owner's call): the trips through Hiroshima now end in Osaka for Kansai Airport, and `suggest_route` doesn't offer that trip for those dates | |
| 1E | Not started | |
| 2: Hakone, Nikko | Transit and 20 place drafts merged 18 Nov 2026; drafts wait for the live load and owner sign-off | #92, #93 |
