---
type: design
status: accepted
code:
  - bento/src/lib/engine/
  - bento/scripts/plan-day.ts
  - bento/src/lib/trips/ready-made/
last_reviewed: 2026-11-21
---

# The engine: recommender and scheduler

The part that would be a fine-tuned model in a worse product. It's a **scoring function and a scheduler**: classical, explainable and tested against fixtures. Pure functions in `bento/src/lib/engine/`, with no framework, network or model, called from server code only.

## Scoring a place for this traveller

The reason shown with a stop is assembled from the terms that actually moved its score (`buildReason`): **the two strongest positive terms and, if large enough, one negative**. Some terms, such as confidence and pace strain, never become a clause. So the reason is true by construction, but it's a selection, not every term.

| Term | Weight | What it measures |
|---|---|---|
| interest match | + 2.5 | Overlap between the place's tags and the traveller's interests (0–1) |
| signature | + 1.5 | How significant it is for a first-timer, set by hand (0–1) |
| confidence | + 1.0 | Verified 1.0, draft 0.4; stub places are excluded |
| season fit | + 0.8 | Whether a place's season (cherry blossom, autumn colour) is typically at its best in that city on that date. 1 inside the window, 0.3 outside it, 0.5 for a place with no season tags |
| discovery fit | + 0.5 | How well-known or off the beaten track, against the traveller's preference |
| redundancy | − 2.0 | The nth place of the same category; decays as 1/n |
| crowds | 1.2 | Crowds against the traveller's crowd tolerance |
| energy | 1.0 | Effort against the traveller's energy |
| skip if (mobility) | − 1.5 | The place's "skip if" against the traveller's constraints |
| budget strain | − 1.0 | Cost against the traveller's budget |
| pace strain | − 0.7 | Duration against what's left of the day |
| travel | − 1.0 per half hour | Extra travel to reach it |

The weights are the values in `score.ts`; the descriptions are summaries.

The weights are configuration (`bento/src/lib/engine/score.ts`), not constants; they're the first thing to tune against the evaluation set.

## Building a day (`planDay`)

1. **Budget:** the pace sets the active minutes: relaxed 360, standard 480, packed 600.
2. **Filter:** drop on hard rules, with no scoring: closed that weekday, on a date it closes every year (`closedYearly`, such as the year-end break; `closures.ts`: "closed 28 Dec – 1 Jan every year") or on a one-off date, booking required and not held, stub coverage, unverified, or a category the traveller excluded ("no beaches" means never). **The one exception is a stop the traveller pinned:** it stays even if it fails a rule, with a warning, and validation never removes a pinned stop.
3. **Anchor:** seed the day with the best place that has a best time window (Fushimi Inari at 07:00 anchors the morning).
4. **Grow:** add the place that gains the most score for the least extra travel, until the time is spent or nothing helps. A place that would make a pinned stop arrive after closing is tried elsewhere in the day, or left out ("left out to leave time to reach … before it closes").
5. **Order:** reorder to cut total travel time, but never into an order that reaches a pinned stop after closing. Two moves, repeated until neither helps: reverse a run of the planner's own stops (2-opt), and move a run of them, either way round, anywhere else in the day, past pins too (or-opt). Pins keep their order and the anchor keeps the front; only the stops the planner chose move. Before the second move a chosen stop could never cross a pin, so a day went Osaka Museum of History → Umeda → back to the castle beside the museum. The search weighs travel, 30 minutes for a busy place missing its quiet window, and a whole day (24 hours) for a stop finished after it closes, so no reordering trades a stop's hours for a shorter route.
6. **Time:** set clock times from opening hours, train legs and meal slots, carrying slack forward.
7. **Validate:** re-check every hard rule on the finished day; on a failure, drop the offender and refill. A pinned stop is never dropped: when one would still be reached after it closes, the nearest unpinned stop between it and the pin before it goes instead ("left out to leave time to reach … before it closes"), one per pass, and only if that really brings the pin earlier. It looks at each late pin in turn. A pin that is late whatever is dropped (its start is fixed by its own time, its opening time or the pin before it, or its visit is longer than its hours) keeps the stops around it and stays late.

It's greedy insertion with local search: not optimal, and it doesn't need to be. It needs to be right, fast and explainable.

### Travel days

A travel day is the day a traveller moves from one stay to the next: the arrival date of every stay after the first (`travelDayOrigins`, `bento/src/lib/engine/travel-day.ts`). That day's plan starts after the move, not at the usual hour, and has that much less time, so it ends when any day would and holds fewer stops.

- **The move** = `MOVE_ALLOWANCE_MIN` (60: checking out, getting to the departure station with bags, and from the arrival station to the new hotel to leave them) + the train between the two cities' hubs, as the route's legs count it (`cityTrainMinutes`). Packing comes before the usual start and checking in after the day, which is why it is less than the two hours `CHANGE_COST_MIN` charges a city change in the route verdict. The 60 is a planning allowance, not a measured figure.
- **No known train:** the allowance + `UNKNOWN_TRAIN_MIN` (150, longer than Tokyo to Kyoto, the longest single move a ready-made trip makes, 134 min hub to hub), and the day says so in a warning.
- The hubs are where a stay starts ([transit](transit.md), "Where a trip lands"): Osaka's is Osaka Station, so Osaka → Kyoto is the 29-minute Special Rapid, not the 13-minute Nozomi from Shin-Osaka, and Osaka → Hiroshima is 94 minutes (the JR Kyoto Line to Shin-Osaka, a change, the Shinkansen).
- Examples, early riser (07:00): Osaka → Kyoto starts at 08:29 (60 + 29), Kyoto → Hiroshima at 09:40 (60 + 100); at 09:00, Tokyo → Kyoto starts at 12:14.
- A day spent in a zero-night city on the way (Himeji, between Kyoto and Hiroshima), or a day trip planned on the arrival date, starts after the move from the last stay to it. A day saved for another stay of the route on that date (planned before the route changed) is not moved: it is measured as a whole day. A day trip there and back from where the traveller sleeps is not a move, and neither is the trip's first day: arriving in Japan is a separate question, not planned yet.
- Pins on a travel day are kept as on any day. `planTrip` takes it from `TripDay.movingFrom` (set by `readyMadeToPlan`) with `trainMinutes`; `plan_days`, `replan_day` (and so "Re-plan this day") and the day box all work it out from the route with `travelDayMoves`, so they agree.
- A start given as a clock time (`dayStartMin`) is taken as it is, and the move still comes out of the day, so a re-planned travel day is no longer than the planned one. A **kept** start (a re-plan or an edit keeping its first stop) is never before the usual start plus the move (`travelDayStart`): a day saved before travel days allowed for the move starts after it on its next re-plan or edit. Nothing records whether a saved start was named, so an early start the traveller once named for an early train is lifted too, and the day says so: "This day now starts about 10:30, after you could arrive from Osaka. Say a start time to change it" (a re-plan's warning; after an edit, the page, from `note=start-lifted` in the address, which carries no words). Times about the move are said to five minutes. A start the traveller **names** (`start_at`) is taken as it is; if it is before they could arrive, the day says so ("This day starts at 08:00, before you could arrive…").
- A pin timed before the move is kept, reached when the day can, with the usual "pinned for … but the day only reaches it by …" warning.

`planDay` returns timed stops with a reason each, meals, budget and slack, the day's cost, and **everything left out, with the term that removed it**. `planTrip` runs the days in order, so no place is used twice, and keeps a place pinned to one day off every other day, so an earlier day can't take it first. Bento Man's `plan_days` doesn't do this yet (it plans day by day from saved pins; changing it changes a tool result and needs a live eval), so starting a ready-made trip will plan through `planTrip`.

## Rules it keeps

- The anchor stays first through growing and ordering; timed pins are placed where the clock reaches them.
- A busy place that would miss its quiet window costs 30 minutes in ordering.
- Scores shown on stops are recomputed against the final order, so "your third temple today" is the third one shown.
- Hard rules live in `filter.ts` and never become penalties.
- Untimed pins keep the order they were given; the planner fills around them but doesn't reorder them. Its own stops may go before, between or after them, wherever the day is shortest.
- Travel between two stops (`travelFromGraph`, `bento/src/lib/engine/travel.ts`) is the train route between their stations, with each end's walk, or a walk straight across when that is quicker. A straight walk is **estimated from the two places' positions, not measured**: the straight line × 1.3 (`WALK_DETOUR`) at 80 m a minute (`WALK_M_PER_MIN`), at least 3 minutes. All three figures, and the caps below, are assumptions chosen to err long. 80 m a minute is the pace Japanese property listings quote "minutes on foot" at, from memory and not checked against the listing rules; the 1.3 is a planning allowance for streets. The traveller reads it as an estimate: "About a 14-min walk" (`copy.plan.transit.walkStraight`); a walk via the station keeps "Walk · 14 min". Neither repeats its minutes after it on the day view (`arriveMinutesSuffix`, `bento/src/lib/trips/arrive-line.ts`); a train journey's door-to-door total still follows its words.
  - In place of a train, or of the no-route estimate, only a straight walk of 20 minutes or less (`DIRECT_WALK_MAX_MIN`, an assumption: past that the straight line says too little about the streets). Two places by the same station were a walk already, `(walk + walk) × 0.8` via the station, and take the shorter of that and straight across, however long.
  - A straight line knows nothing of hills or moats (review found lines from Zeniarai Benten to Kotoku-in and over Kuzuharaoka, and from Osaka Castle's keep to the Museum of History). So a hike or a castle is never walked to or from in a straight line, and a steep place (`physicalDemand` 0.5 and over) that has a station never has one in place of a train. A steep place with no station does walk straight (same factor and caps): its only other time is the flat 45-minute guess, and the slope is there whichever way you arrive; before, Otokoyama in Himeji cost 45 minutes from anywhere, and a packed day went from the castle out to Mount Shosha and back to Otokoyama beside it. Beside another place by its own station a steep place keeps the shorter walk: both are a walk from that station anyway, and the slope is on either one (Kiyomizu-dera down through Ninenzaka).
  - A traveller with a hard mobility need (`HARD_MOBILITY`: wheelchair, limited mobility, step-free) gets straight walks of 5 minutes at most (`MOBILITY_WALK_MAX_MIN`, about 300 m, where a step or slope the positions can't show is least likely); past that their day goes by the stations as before. Every caller passes the traveller's mobility.
  - Why: without straight walks the graph went through Tanimachi 4-chome and Osakajokoen, so the museum across the road from the castle park looked half an hour away; within one station every order looked about the same, so Arashiyama went Okochi Sanso → down to Togetsukyo → back up the bamboo path.
- It never invents a train time. Walks straight across are estimated from positions, as above, and say so. A place with no station costs a flat 45 minutes and a warning, unless it is a short straight walk from the stop before or after (it has a position, as every seed place does): then that leg is the walk.
- A closure that comes every year is a month-day range, `"MM-DD..MM-DD"` or one `"MM-DD"`; an end before the start wraps the year (`"12-28..01-01"` is 28 Dec to 1 Jan). The same check (`closedYearlyOn`) leaves a place out of a day, warns about a pinned one ("Osaka Castle is pinned but closed 28 Dec – 1 Jan every year — kept because you pinned it"), and refuses a date change that would move a planned stop into it (`shift.ts`). Bento Man's `get_place` adds `closed_every_year` ("28 Dec – 1 Jan") next to the hours, only for places that have one.
- Only the returned day warns: its timing ("opens at …", "pinned for … but the day only reaches it by …") and its own legs ("has no station in Bento's train data", "no route between …"), each said once. The trial days and the candidates growing and ordering look at never add warnings. A no-station stop alone in its day has no leg to estimate, so it doesn't warn. `ready-made.test.ts` checks that no warning on any ready-made day names a place the day doesn't hold.
- **Seasons are typical windows, not months** (`bento/src/lib/engine/seasons.ts`). One table holds each city's typical best-viewing dates per season, as month-day ranges, with an area override where a city spans very different heights (Okunikko's lakes and falls colour weeks before Nikko's shrines). Each window comes from one named spot's "typical best viewing" (例年の見頃) on Weathernews (Nara's cherry blossom: tenki.jp, for its Somei-Yoshino), read November 2026, and the source sits beside it in the table. No margin is added either side, because no source gives one. Only a date inside the window counts as in season. Then the reason says "usually at its best around now", because the peak moves by a week or more from year to year and Bento makes no forecast. Outside the window a season tag earns no boost and no claim. A city with no windows (a new city, or a season the table doesn't list for it) never counts as in season. `bento/src/lib/engine/__tests__/seasons.test.ts` covers it, including 31 December and 8 March in Kyoto.
- **Known gaps:** opening windows are soft except for the anchor; season tags are optional and neutral when absent; season windows are per city (or area), not per place, and they don't follow a given year's forecast.

## Ready-made trips

Implementation: partial (packages 1B and 1C of the ready-made trips plan: the trips, and starting one from "Plan a Japan trip"; no Bento Man tool reads them yet).

A ready-made trip is **saved input to the planner, never a hand-written itinerary**: its cities with nights, which day is a day trip, and up to three must-see places per day (the first trips use two at most). The engine builds the days for the traveller's own dates and pace, so a trip states no times, fares or durations.

- `bento/src/lib/trips/ready-made/`: `types.ts` (the shape, and `READY_MADE_CITIES`, the nine cities a trip may use), one file per trip, `index.ts` (the list). Titles, summaries and a reason per city are in `copy.readyMade.trips`.
- A trip of _n_ days has _n_ − 1 nights, the way a trip's end date works: the last day is spent in the last city. A zero-night city has its day named in `dayTrips`; a one-day trip is a single zero-night city.
- Must-sees are pins, listed in visiting order (the one that closes earliest first), because the planner doesn't reorder pins. It does put its own stops on either side of them, wherever the day is shortest. The first and last day of a longer trip carry one at most (arriving, leaving); a full day has two at most, one when they are long, so the planner still chooses something around them at every pace.
- `bento/src/lib/trips/__tests__/ready-made-order.test.ts` holds the days the 20 Nov read-through found going back and forth (Osaka in a day; the five-day trip's Dotonbori, Osaka Castle, Kyoto east and Arashiyama days; Kyoto's east side; the Arashiyama loops; the one-day Arashiyama trip starting by the Kamo river), each asserted on straight-line distances between the seeds' positions, not the engine's own minutes. Over every trip, pace and three starts, no day leaves a stop's area (600 m) and comes back by a detour of more than 3.5 km. In walking districts (Nara Park and Naramachi, Yokohama's bay, Shibuya at sunset) the shortest walk still loops back by up to about 3.4 km. Before the fix the worst was 10 km, and the average day's travel went from 59 to 45 minutes. A return to an evening place (opening at 17:00 or later, so the day ends there) doesn't count: ordering can't fix it.
- A day spent in a zero-night city between two stays (Himeji, between Kyoto or Osaka and Hiroshima) is planned as an ordinary day in that city. The ride on to the next stay that evening and the luggage aren't planned, and the words don't promise "get off and get back on".
- `readyMadeToPlan(trip, startDate)` turns one into the planner's inputs: the route in `propose_route`'s shape (with reasons), every date with its city and pins (`planTrip`'s days), and the day-trip dates in `plan_days`'s shape.
- `bento/src/lib/trips/__tests__/ready-made.test.ts` checks every trip against the seeds: ids exist and sit in that day's city, nights add up, `assessRoute` isn't overpacked and knows every train, no two must-sees on a day conflict, the first and last days are light, and `planTrip` fills every day, chooses at least one stop of its own on every full day (a relaxed travel day may hold only its must-sees: the move takes that time), never has to drop a stop to reach a must-see, and keeps every must-see open and within its hours. That is checked for a start on each weekday, a start in each season and two starts over the year-end break (30 Dec and 1 Jan), at each pace, with a 07:00 and a 09:00 start.
- What a season changes there is only the scoring (season tags). A place has one set of hours all year (the shortest, when they vary), so the test can't catch an hours change by season. Public holidays aren't in the place data, so they aren't checked either. Year-end closures are (`closedYearly`), for the places whose closure has been read from their own site.
- **A start that puts a must-see on a day it is closed is refused** (the owner's call, 21 Nov 2026), not planned with a warning. `closedMustSees(trip, startDate, places)` (`bento/src/lib/trips/ready-made/closed.ts`, pure) lists every must-see closed on its day for that start: that weekday (`closedWeekdays`), a one-off date (`closedDates`), or a date it closes every year (`closedYearlyOn`). The picker refuses such a start before writing anything. It names every closed must-see with its closure and its day, then the nearest start that keeps them all open (`nearestOpenStart`: up to 60 days either way, the earlier on a tie, never before the earliest day the form takes), or asks for another first day when there is none ("Osaka Castle is closed 28 Dec – 1 Jan every year, and this start puts it on Thu 31 Dec. The nearest first day that works is Fri 1 Jan.", `copy.readyMade.picker.errors`). `suggest_route` doesn't offer such a trip for a trip with a start date. With today's seeds, three must-sees refuse starts, all over the year-end break: Osaka Castle (its main tower, the paid part, closes 28 Dec – 1 Jan), the Peace Memorial Museum (30–31 Dec) and Shukkeien Garden (29–31 Dec). The refused starts:
  - `osaka-day`: 28 Dec – 1 Jan (Osaka Castle).
  - `osaka-kyoto-nara-5`: 27–31 Dec (Osaka Castle).
  - `classic-7`: 23–27 Dec (Osaka Castle).
  - `kansai-hiroshima-7`: 23–26 Dec (Shukkeien on 23–25 Dec, the Peace Memorial Museum on 25–26 Dec).
  - `tokyo-to-miyajima-10`: 20–26 Dec (Shukkeien on 20–22 Dec, Osaka Castle on 22–26 Dec, the Peace Memorial Museum on 23–24 Dec).
  - `all-nine-14`: 16–23 Dec (Shukkeien on 16–18 Dec, Osaka Castle on 19–23 Dec, the Peace Memorial Museum on 19–20 Dec).

  `ready-made.test.ts` pins this list, place by place, over every start from 11 Dec to 5 Jan (the seeds' yearly closures run from 25 Dec to 4 Jan, so that covers every start whose days can meet one), and plans every start in that window that isn't refused (at the standard pace only) as well as its weekday and season starts, failing on any closed must-see. Its weekday starts never meet a weekly closing day, so that part of the check never fires today and is there for completeness.
- **Before a trip is published,** every city it uses must be outline or deep on the live site: the planner refuses a city it doesn't know. The test treats every seed place as verified and can't see live tiers.
- **Starting one** (`bento/src/lib/trips/ready-made/start.ts`, called by `startReadyMadeTrip` in `bento/src/app/trips/actions.ts`): the traveller picks a trip, a start date (required: closing days need real dates; not before today in Japan, with a day's slack for travellers west of it) and a party size. The picker lists only trips whose every city, day trips included, is outline or deep in `city_coverage` (`availableReadyMade`); the others are left out, not shown as "coming". The action first counts the traveller's trips: at the database's cap of 100 it says so and reads nothing more (two starts at once can both pass the count; the database's cap then refuses the second, with the same message). It then checks coverage again, that every must-see is in `places_public` (`SupabaseCatalogue`, the same reads as `SupabaseStore`), and that none is closed on its day for this start (`closedMustSees`, above), before writing anything; the form keeps the traveller's answers on any refusal. It creates the trip as the traveller, so RLS, the trip cap and the write allowance apply. No rate limit (`take_rate_token`) applies to creating a trip, here or in the other trip forms: those buckets are for model calls. Then it runs `planTrip` with the traveller's saved preferences and the must-sees pinned, checks every pin is in the plan, and saves the route and the days as one proposal stored with a first chat message and applied at once through `applyProposal` (`apply_proposal`): the same path, and the same single database step, as an accepted chat proposal. If saving fails, including `apply_proposal` returning `stale_day` or an outcome the store can't read, the new trip is deleted (a failed delete is logged) and the traveller is told it didn't start. The route card's legs come from `assessRoute`, as in the chat: a day trip is there and back from where the traveller sleeps. Nothing calls the model. Tests: `bento/src/lib/trips/__tests__/ready-made-start.test.ts` (the memory store, plus `SupabaseStore`'s own append and apply over a stubbed client; not a real database).

## Why not ask a model

It runs in milliseconds and costs nothing. It's unit-testable, so "Arashiyama and Fushimi Inari in one afternoon" becomes a failing test rather than a complaint. It produces the same plan twice for the same input. And because every clause of the reason traces to a term, the traveller can disagree with the reasoning, not just the result.

## Tests and tools

- Tests: `bento/src/lib/engine/__tests__/`, fixtures in `__fixtures__/kyoto.ts`. The traps must stay green:
  - Arashiyama and Fushimi Inari never share a day. This covers the whole Arashiyama area: every Kyoto place at the Randen, Hankyu or JR Saga-Arashiyama station conflicts with Fushimi Inari on both sides (`arashiyama-area.test.ts`);
  - a Monday never fills with something closed on Mondays, and 1 January never with something closed over New Year (`closures.test.ts`);
  - "no hiking" means never.
- Try it: `npx tsx scripts/plan-day.ts` (add a date, or `--pin kyt-sanjusangendo@10:00`).
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Engine (P4)".

Related: [division of labour](division-of-labour.md), [Japan rules](japan-rules.md), [transit](transit.md), [place data](place-data.md). Source: spec §05; `bento/README.md` "The engine".
