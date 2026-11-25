---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/app/trips/[id]/day-box.tsx
  - bento/src/app/trips/[id]/day-actions.ts
  - bento/src/app/trips/[id]/hold-to-drag.ts
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
3. They can drag stops into a new order (on a phone: hold a stop, then drag it), move them up or down, pin, unpin or remove them. These apply at once.
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

## Moving a stop on a phone

With a mouse, a stop is dragged at once, as before. With a finger, the traveller **holds a stop still for about half a second** (450 ms): it lifts (solid, outlined, a slight grow unless reduced motion is on, and a short buzz where the phone allows), follows the finger, and lands where it is let go. The stop it would land on gets a dashed outline. Letting go saves the new order through the same edit as a mouse drag (`reorderDay`), and the engine re-times the day.

- **A swipe still scrolls.** Moving the finger more than 10 px before the hold ends cancels it, and so does the page starting to scroll; the page is held still only once a stop has lifted.
- Near the top or bottom of the screen (64 px), a lifted stop scrolls the page, faster the closer it is to the edge. Only the finger holding the stop counts: a second finger or a mouse doesn't steer it.
- **A drop never saves a stale order.** The lift remembers the day's order. If the day changes before the drop (an up or down tap, a refresh), the drag is cancelled and nothing is saved, and so it is if the held stop disappears or anything moves the stops on the page (a booking block, a free-time tile, a stop's height, something above the box). While a stop is lifted, or any stop edit (a reorder, Pin, up, down, Remove) is on its way, the other edits and holds wait until it has finished, whether it worked or failed.
- Pressing a button, the Map link or "About this place" never starts a hold.
- **A pen doesn't hold-and-drag.** A pen can scroll the page without the touch events that keep it still under a lifted stop, so it uses the up and down buttons.
- A pinned stop moves like any other, as with the up and down buttons: re-timing never starts it before its pinned time (later only if the stops before it run on), and the others follow.
- The up and down buttons stay, for keyboards, screen readers and pens.
- The rules are pure and tested (`hold-to-drag.ts`); the box only feeds them pointer events, scrolls and the cards' positions. On any device with a touch screen a stop's text can't be selected, so a long press doesn't select it.

## Adding a place

Each planned day in a city Bento can plan ends with an **Add a place** button. It opens a sheet (a bottom sheet on a phone; a modal dialog that keeps focus inside, closes on Escape and gives focus back): the traveller searches Bento's places in that day's city by English or Japanese name (verified places only, read through `places_public`) and picks one.

The server checks it against the day in the engine, never a model ([engine](../30-software/engine.md#adding-a-place-by-hand-fitplace)): open that day, a ticket held if one is needed, nothing it can't share a day with, open when the day reaches it, an evening place reached near its evening, the day's end and time budget, the stops already there kept on time and before closing, and not across town from its neighbours. It goes in at the spot in the traveller's order where it fits best.

- **It fits:** it is added at once and re-timed like any edit. The sheet says what's true about it there, from the engine's own clauses, and no more ("Good call. It's on your way between Nanzen-ji and Gion; matches history & castles. Shoren-in goes in at 11:20."). With nothing true to praise it just says it fits and when.
- **It doesn't fit:** nothing changes yet. The sheet lists each reason in the planner's words ("closed on Mondays", "the day would run 1h 20m over its 8h", "can't share a day with Fushimi Inari Taisha — they're at opposite ends of the city") and offers **Add anyway** or **Not now**. Added anyway, it goes in at the same spot and the day shows its usual warnings (the over-budget line and marks).
- A leg Bento has no route for is said either way ("No route on record from … — assumed 45 min").
- A place already on that day can't be added twice. An evening-only place is added pinned at its evening start.

## Travel days

On the day a traveller moves to their next stay, the planned day in the new city starts after the move (checking out, the train, leaving bags), so its first stop is later and it holds fewer stops ([engine](../30-software/engine.md#travel-days)). The box and the day strip measure it against that shorter day, and the travel-day card says the time the plan allows for it, to five minutes ("The plan allows about 1h 30m to move from Osaka: checking out, the train and leaving your bags."). With no train time it gives no figure: the train card already says Bento has no train for it, and the plan's warning says the guess once. Re-planning or editing the day keeps the move, and a day saved before travel days allowed for it moves after it then; the card says so ("This day now starts about 10:30, after you could arrive from Osaka. Say a start time to change it"). If the city list can't be read, an edit re-times the day with no move rather than failing. A day with no time left after the move reads as full, never as a broken bar. If the train data can't be read, the day is measured as a whole day and the line is left off. On a day spent in a stop on the way (Himeji), the card above the day has the train there, and the train on to the next stay sits below the day's stops ("After the day here: on to Hiroshima"), so it never reads as leaving first.

## What it doesn't do

- No live maps inside Bento: all planning data is local.

## Failure behaviour

- If a day no longer fits after an edit, the box says so (the over-budget line and marks).

## Code and tests

- The box: `bento/src/app/trips/[id]/day-box.tsx`; the edits: `day-actions.ts`; re-timing: `bento/src/lib/engine/retime.ts`; day stats: `engine/day-stats.ts`.
- Adding a place: the sheet `add-place.tsx`, the actions `placesForDay` and `addPlaceToDay` in `day-actions.ts`, the check `bento/src/lib/engine/fit.ts`, the search `bento/src/lib/trips/place-search.ts`. Tests: `add-place.test.ts`, `engine/__tests__/fit.test.ts`, `trips/place-search.test.ts`.
- Map links: `bento/src/lib/maps/links.ts`.
- Design: palette, motion and fonts in [design](../20-design/README.md).
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Day view (P7)".

Source: spec §13 (P7); `bento/README.md` "The day view".
