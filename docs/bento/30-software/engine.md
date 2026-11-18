---
type: design
status: accepted
code:
  - bento/src/lib/engine/
  - bento/scripts/plan-day.ts
  - bento/src/lib/trips/ready-made/
last_reviewed: 2026-11-17
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
| season fit | + 0.8 | Autumn leaves in November, cherry blossom in April, festivals |
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
2. **Filter:** drop on hard rules, with no scoring: closed that weekday or date, booking required and not held, stub coverage, unverified, or a category the traveller excluded ("no beaches" means never). **The one exception is a stop the traveller pinned:** it stays even if it fails a rule, with a warning, and validation never removes a pinned stop.
3. **Anchor:** seed the day with the best place that has a best time window (Fushimi Inari at 07:00 anchors the morning).
4. **Grow:** add the place that gains the most score for the least extra travel, until the time is spent or nothing helps. A place that would make a pinned stop arrive after closing is tried elsewhere in the day, or left out ("left out to leave time to reach … before it closes").
5. **Order:** reorder to cut total travel time, but never into an order that reaches a pinned stop after closing.
6. **Time:** set clock times from opening hours, train legs and meal slots, carrying slack forward.
7. **Validate:** re-check every hard rule on the finished day; on a failure, drop the offender and refill. A pinned stop is never dropped: when one would still be reached after it closes, the nearest unpinned stop between it and the pin before it goes instead ("left out to leave time to reach … before it closes"), one per pass, and only if that really brings the pin earlier. It looks at each late pin in turn. A pin that is late whatever is dropped (its start is fixed by its own time, its opening time or the pin before it, or its visit is longer than its hours) keeps the stops around it and stays late.

It's greedy insertion with local search: not optimal, and it doesn't need to be. It needs to be right, fast and explainable.

`planDay` returns timed stops with a reason each, meals, budget and slack, the day's cost, and **everything left out, with the term that removed it**. `planTrip` runs the days in order, so no place is used twice, and keeps a place pinned to one day off every other day, so an earlier day can't take it first. Bento Man's `plan_days` doesn't do this yet (it plans day by day from saved pins; changing it changes a tool result and needs a live eval), so starting a ready-made trip will plan through `planTrip`.

## Rules it keeps

- The anchor stays first through growing and ordering; timed pins are placed where the clock reaches them.
- A busy place that would miss its quiet window costs 30 minutes in ordering.
- Scores shown on stops are recomputed against the final order, so "your third temple today" is the third one shown.
- Hard rules live in `filter.ts` and never become penalties.
- Untimed pins keep the order they were given; the planner fills around them but doesn't reorder them.
- It never invents a travel time. A place with no station costs a flat 45 minutes and a warning.
- Only the returned day's timing warns ("opens at …", "pinned for … but the day only reaches it by …"): the trial days growing and ordering try out never add warnings.
- **Known gaps:** opening windows are soft except for the anchor; season tags are optional and neutral when absent; a "has no station in Bento's train data" warning can name a place growth only looked at and the day doesn't hold (saying it only for the day's own legs changes `plan_days`' result, so it waits for a live eval).

## Ready-made trips

Implementation: partial (package 1B of the ready-made trips plan; nothing starts one yet, and no page or Bento Man tool reads them).

A ready-made trip is **saved input to the planner, never a hand-written itinerary**: its cities with nights, which day is a day trip, and up to three must-see places per day (the first trips use two at most). The engine builds the days for the traveller's own dates and pace, so a trip states no times, fares or durations.

- `bento/src/lib/trips/ready-made/`: `types.ts` (the shape, and `READY_MADE_CITIES`, the nine cities a trip may use), one file per trip, `index.ts` (the list). Titles, summaries and a reason per city are in `copy.readyMade.trips`.
- A trip of _n_ days has _n_ − 1 nights, the way a trip's end date works: the last day is spent in the last city. A zero-night city has its day named in `dayTrips`; a one-day trip is a single zero-night city.
- Must-sees are pins, listed in visiting order (the one that closes earliest first), because the planner doesn't reorder pins. The first and last day of a longer trip carry one at most (arriving, leaving); a full day has two at most, one when they are long, so the planner still chooses something around them at every pace.
- A day spent in a zero-night city between two stays (Himeji, between Kyoto or Osaka and Hiroshima) is planned as an ordinary day in that city. The ride on to the next stay that evening and the luggage aren't planned, and the words don't promise "get off and get back on".
- `readyMadeToPlan(trip, startDate)` turns one into the planner's inputs: the route in `propose_route`'s shape (with reasons), every date with its city and pins (`planTrip`'s days), and the day-trip dates in `plan_days`'s shape.
- `bento/src/lib/trips/__tests__/ready-made.test.ts` checks every trip against the seeds: ids exist and sit in that day's city, nights add up, `assessRoute` isn't overpacked and knows every train, no two must-sees on a day conflict, the first and last days are light, and `planTrip` fills every day, chooses at least one stop of its own on every full day, never has to drop a stop to reach a must-see, and keeps every must-see open and within its hours. That is checked for a start on each weekday and a start in each season, at each pace, with a 07:00 and a 09:00 start.
- What a season changes there is only the scoring (season tags). A place has one set of hours all year (the shortest, when they vary), so the test can't catch an hours change by season. Public holidays and year-end closures aren't in the place data, so they aren't checked either.
- **Before a trip is published,** every city it uses must be outline or deep on the live site: the planner refuses a city it doesn't know. The test treats every seed place as verified and can't see live tiers.

## Why not ask a model

It runs in milliseconds and costs nothing. It's unit-testable, so "Arashiyama and Fushimi Inari in one afternoon" becomes a failing test rather than a complaint. It produces the same plan twice for the same input. And because every clause of the reason traces to a term, the traveller can disagree with the reasoning, not just the result.

## Tests and tools

- Tests: `bento/src/lib/engine/__tests__/`, fixtures in `__fixtures__/kyoto.ts`. The traps must stay green:
  - Arashiyama and Fushimi Inari never share a day. This covers the whole Arashiyama area: every Kyoto place at the Randen, Hankyu or JR Saga-Arashiyama station conflicts with Fushimi Inari on both sides (`arashiyama-area.test.ts`);
  - a Monday never fills with something closed on Mondays;
  - "no hiking" means never.
- Try it: `npx tsx scripts/plan-day.ts` (add a date, or `--pin kyt-sanjusangendo@10:00`).
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Engine (P4)".

Related: [division of labour](division-of-labour.md), [Japan rules](japan-rules.md), [transit](transit.md), [place data](place-data.md). Source: spec §05; `bento/README.md` "The engine".
