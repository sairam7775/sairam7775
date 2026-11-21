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
last_reviewed: 2026-11-21
---

# The day view (the box)

## Summary

Each day of a trip is drawn as **a bento box**: a lacquer frame of compartments, each sized to the time its stop takes. So an over-packed day *looks* over-packed before you read a word. The train is written on the frame between compartments, lunch sits in the first gap, and a dashed line shows where the day's time runs out.

## User journey

1. On a trip page (`/trips/<id>?day=YYYY-MM-DD`), a strip shows every date of the accepted route, with a bar for how full each day is.
2. The traveller opens a day and sees its box.
3. They can drag stops into a new order, move them up or down, pin, unpin or remove them. These apply at once.
4. Or they ask to **re-plan this day**: the engine chooses again around what's pinned, and the result comes back as a [proposal](proposals-and-diffs.md).
5. Each stop has Map and Directions links to Google Maps.

## Acceptance criteria

- A traveller's own edit (drag, pin, remove) applies at once, and the day is re-timed by the engine (`retime.ts`) with real train legs, never by the screen and never by a model.
- Re-timing makes no choices: the order is the traveller's, and the times follow.
- Only `planDay` chooses stops, and it always returns a proposal.
- A tile's height is time (about a pixel a minute); tiles past the day's time budget carry an "over" mark.
- Stats for the day (active time, the over-budget point, the lunch gap) are summed from what's stored; nothing is invented.
- Map links are plain Google Maps links: the place's name (Japanese when known) and city, or a train journey's two stations. **Nothing reaches Google until the traveller opens one,** and the privacy page says so.
- A stop has a map link only while its place is still public.

## Travel days

On the day a traveller moves to their next stay, the planned day in the new city starts after the move (checking out, the train, leaving bags), so its first stop is later and it holds fewer stops ([engine](../30-software/engine.md#travel-days)). The box and the day strip measure it against that shorter day, and the travel-day card says the time the plan allows for it, to five minutes ("The plan allows about 1h 30m to move from Osaka: checking out, the train and leaving your bags."). With no train time it gives no figure: the train card already says Bento has no train for it, and the plan's warning says the guess once. Re-planning or editing the day keeps the move, and a day saved before travel days allowed for it moves after it then; the card says so ("This day now starts about 10:30, after you could arrive from Osaka. Say a start time to change it"). If the city list can't be read, an edit re-times the day with no move rather than failing. A day with no time left after the move reads as full, never as a broken bar. If the train data can't be read, the day is measured as a whole day and the line is left off.

## What it doesn't do

- No live maps inside Bento: all planning data is local.

## Failure behaviour

- If a day no longer fits after an edit, the box says so (the over-budget line and marks).

## Code and tests

- The box: `bento/src/app/trips/[id]/day-box.tsx`; the edits: `day-actions.ts`; re-timing: `bento/src/lib/engine/retime.ts`; day stats: `engine/day-stats.ts`.
- Map links: `bento/src/lib/maps/links.ts`.
- Design: palette, motion and fonts in [design](../20-design/README.md).
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Day view (P7)".

Source: spec §13 (P7); `bento/README.md` "The day view".
