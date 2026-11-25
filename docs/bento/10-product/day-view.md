---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/app/trips/[id]/day-box.tsx
  - bento/src/app/trips/[id]/day-actions.ts
  - bento/src/lib/engine/retime.ts
  - bento/src/lib/engine/day-stats.ts
  - bento/src/lib/engine/travel-day.ts
  - bento/src/lib/bento-man/trip-view.ts
  - bento/src/app/trips/[id]/add-place.tsx
  - bento/src/lib/engine/fit.ts
last_reviewed: 2026-11-25
---

# The day view (the box)

## Summary

Each day of a trip is drawn as **a bento box**: a lacquer frame of compartments, each sized to the time its stop takes. So an over-packed day *looks* over-packed before you read a word. The train is written on the frame between compartments, lunch sits in the first gap, a gap of over two hours says "Free time" and what it waits for ("Nothing planned until Dotonbori at 17:30."), and a dashed line shows where the day's time runs out.

## User journey

1. On a trip page (`/trips/<id>?day=YYYY-MM-DD`), a strip shows every date of the accepted route, with a bar for how full each day is.
2. The traveller opens a day and sees its box.
3. They can drag stops into a new order, move them up or down, pin, unpin or remove them. These apply at once.
4. Or they ask to **re-plan this day**: the engine chooses again around what's pinned, and the result comes back as a [proposal](proposals-and-diffs.md).
5. Or they **add a place** they want to go: see below.
6. Each stop has Map and Directions links to Google Maps.

## Acceptance criteria

- A traveller's own edit (drag, pin, remove) applies at once, and the day is re-timed by the engine (`retime.ts`) with real train legs, never by the screen and never by a model.
- Re-timing makes no choices: the order is the traveller's, and the times follow.
- Only `planDay` chooses stops, and it always returns a proposal.
- A tile's height is time (about a pixel a minute); tiles past the day's time budget carry an "over" mark.
- Stats for the day (active time, the over-budget point, the lunch gap, free time) are summed from what's stored; nothing is invented.
- Map links are plain Google Maps links: the place's name (Japanese when known) and city, or a train journey's two stations. **Nothing reaches Google until the traveller opens one,** and the privacy page says so.
- A stop has a map link only while its place is still public.

## Adding a place

Each planned day in a city Bento can plan ends with an **Add a place** button. It opens a sheet (a bottom sheet on a phone; a modal dialog that keeps focus inside, closes on Escape and gives focus back): the traveller searches Bento's places in that day's city by English or Japanese name (verified places only, read through `places_public`) and picks one.

The server checks it against the day in the engine, never a model ([engine](../30-software/engine.md#adding-a-place-by-hand-fitplace)): open that day, a ticket held if one is needed, nothing it can't share a day with, open when the day reaches it, an evening place reached near its evening, the day's end and time budget, the stops already there kept on time and before closing, and not across town from its neighbours. It goes in at the spot in the traveller's order where it fits best.

- **It fits:** it is added at once and re-timed like any edit. The sheet says what's true about it there, from the engine's own clauses, and no more ("Good call. It's on your way between Nanzen-ji and Gion; matches history & castles. Shoren-in goes in at 11:20."). With nothing true to praise it just says it fits and when.
- **It doesn't fit:** nothing changes yet. The sheet lists each reason in the planner's words ("closed on Mondays", "the day would run 1h 20m over its 8h", "can't share a day with Fushimi Inari Taisha — they're at opposite ends of the city") and offers **Add anyway** or **Not now**. Added anyway, it goes in at the same spot and the day shows its usual warnings (the over-budget line and marks), and under the stop what's off about it ("Closed on Mondays"), worked out again whenever the page is drawn, so it stays after the sheet closes and goes once it no longer applies (a ticket booked, the stop moved).
- If the day changed between the check and the write (another tab, an accepted proposal), nothing is added: "This day changed while Bento was checking, so nothing was added. Look at the day and try again." If the save timed out, the sheet says Bento couldn't confirm it, never that nothing changed.
- A leg Bento has no route for is said either way ("No route on record from … — assumed 45 min").
- A place already on that day can't be added twice. An evening-only place is added pinned at its evening start.

**A place Bento doesn't know.** When the name typed isn't one of the matches, the sheet offers to add it as the traveller's own stop (the owner's call: free text too). It says plainly that Bento can't check its hours or the travel time, asks how long (an hour unless changed, 30 minutes to 4 hours), and adds it at the end of the day, never "fits". The result lists what the day's clock can still say (over budget, past the day's end). On the day it reads "Not one of Bento's places, so its hours and the travel to it aren't checked."; the legs to and from it are the re-timer's 45-minute guess, written on the frame as "Travel time unknown — the day allows 45 min" and counted in the day's time. It has no Map link. One name is one stop a day. The download and the companions' sheet show it with the same line. A re-plan doesn't keep it: the proposal shows it out, and rejecting the proposal keeps the day as it was. Bento Man sees it in the trip as its name and key.

## Travel days

On the day a traveller moves to their next stay, the planned day in the new city starts after the move (checking out, the train, leaving bags), so its first stop is later and it holds fewer stops ([engine](../30-software/engine.md#travel-days)). The box and the day strip measure it against that shorter day, and the travel-day card says the time the plan allows for it, to five minutes ("The plan allows about 1h 30m to move from Osaka: checking out, the train and leaving your bags."). With no train time it gives no figure: the train card already says Bento has no train for it, and the plan's warning says the guess once. Re-planning or editing the day keeps the move, and a day saved before travel days allowed for it moves after it then; the card says so ("This day now starts about 10:30, after you could arrive from Osaka. Say a start time to change it"). If the city list can't be read, an edit re-times the day with no move rather than failing. A day with no time left after the move reads as full, never as a broken bar. If the train data can't be read, the day is measured as a whole day and the line is left off. On a day spent in a stop on the way (Himeji), the card above the day has the train there, and the train on to the next stay sits below the day's stops ("After the day here: on to Hiroshima"), so it never reads as leaving first.

## What it doesn't do

- No live maps inside Bento: all planning data is local.

## Failure behaviour

- If a day no longer fits after an edit, the box says so (the over-budget line and marks).

## Code and tests

- The box: `bento/src/app/trips/[id]/day-box.tsx`; the edits: `day-actions.ts`; re-timing: `bento/src/lib/engine/retime.ts`; day stats: `engine/day-stats.ts`.
- Adding a place: the sheet `add-place.tsx`, the actions `placesForDay`, `addPlaceToDay` and `addCustomStop` in `day-actions.ts`, the free-text key `bento/src/lib/bento-man/custom-stop.ts`, the column `itinerary_items.custom_name` (migration 0036), the check `bento/src/lib/engine/fit.ts`, the search `bento/src/lib/trips/place-search.ts`. Tests: `add-place.test.ts`, `engine/__tests__/fit.test.ts`, `trips/place-search.test.ts`.
- Map links: `bento/src/lib/maps/links.ts`.
- Design: palette, motion and fonts in [design](../20-design/README.md).
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Day view (P7)".

Source: spec §13 (P7); `bento/README.md` "The day view".
