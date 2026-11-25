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
5. Each stop has Map and Directions links to Google Maps.

## Acceptance criteria

- A traveller's own edit (drag, pin, remove) applies at once, and the day is re-timed by the engine (`retime.ts`) with real train legs, never by the screen and never by a model.
- Re-timing makes no choices: the order is the traveller's, and the times follow.
- Only `planDay` chooses stops, and it always returns a proposal.
- A tile's height is time (about a pixel a minute); tiles past the day's time budget carry an "over" mark.
- Stats for the day (active time, the over-budget point, the lunch gap, free time) are summed from what's stored; nothing is invented.
- Map links are plain Google Maps links: the place's name (Japanese when known) and city, or a train journey's two stations. **Nothing reaches Google until the traveller opens one,** and the privacy page says so.
- A stop has a map link only while its place is still public.

## Moving a stop on a phone

With a mouse, a stop is dragged at once, as before. With a finger or a pen, the traveller **holds a stop still for about half a second** (450 ms): it lifts (a ring, a slight grow unless reduced motion is on, and a short buzz where the phone allows), follows the finger, and lands where it is let go. The card it would land on is ringed. Letting go saves the new order through the same edit as a mouse drag (`reorderDay`), and the engine re-times the day.

- **A swipe still scrolls.** Moving the finger more than 10 px before the hold ends cancels it, and the page is held still only once a stop has lifted.
- Near the top or bottom of the screen (64 px), a lifted stop scrolls the page, faster the closer it is to the edge.
- Pressing a button, the Map link or "About this place" never starts a hold.
- A pinned stop moves like any other, as with the up and down buttons: re-timing never starts it before its pinned time (later only if the stops before it run on), and the others follow.
- The up and down buttons stay, for keyboards and screen readers.
- The rules are pure and tested (`hold-to-drag.ts`); the box only feeds them pointer events and the cards' positions. On touch screens a stop's text can't be selected, so a long press doesn't select it.

## Travel days

On the day a traveller moves to their next stay, the planned day in the new city starts after the move (checking out, the train, leaving bags), so its first stop is later and it holds fewer stops ([engine](../30-software/engine.md#travel-days)). The box and the day strip measure it against that shorter day, and the travel-day card says the time the plan allows for it, to five minutes ("The plan allows about 1h 30m to move from Osaka: checking out, the train and leaving your bags."). With no train time it gives no figure: the train card already says Bento has no train for it, and the plan's warning says the guess once. Re-planning or editing the day keeps the move, and a day saved before travel days allowed for it moves after it then; the card says so ("This day now starts about 10:30, after you could arrive from Osaka. Say a start time to change it"). If the city list can't be read, an edit re-times the day with no move rather than failing. A day with no time left after the move reads as full, never as a broken bar. If the train data can't be read, the day is measured as a whole day and the line is left off. On a day spent in a stop on the way (Himeji), the card above the day has the train there, and the train on to the next stay sits below the day's stops ("After the day here: on to Hiroshima"), so it never reads as leaving first.

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
