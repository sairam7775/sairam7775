---
type: design
status: accepted
code:
  - bento/src/lib/engine/
  - bento/scripts/plan-day.ts
last_reviewed: 2026-11-13
---

# The engine: recommender and scheduler

The part that would be a fine-tuned model in a worse product. It's a **scoring function and a scheduler**: classical, explainable and tested against fixtures. Pure functions in `bento/src/lib/engine/`, with no framework, network or model, called from server code only.

## Scoring a place for this traveller

Every term that moves the score adds one clause to the reason shown with the stop, so **the reason is true by construction**: it's assembled from the terms that actually counted, never written afterwards.

| Term | Weight | What it measures |
|---|---|---|
| interest match | + 2.5 | Overlap between the place's tags and the traveller's interests (0–1) |
| signature | + 1.5 | How significant it is for a first-timer, set by hand (0–1) |
| confidence | + 1.0 | Verified 1.0, draft 0.4; stub places are excluded |
| season fit | + 0.8 | Autumn leaves in November, cherry blossom in April, festivals |
| redundancy | − 2.0 | The nth place of the same category; decays as 1/n |
| mobility conflict | − 1.5 | The place's "skip if" against the traveller's constraints |
| budget strain | − 1.0 | Cost against the traveller's budget |
| pace strain | − 0.7 | Duration against what's left of the day |

The weights are configuration (`bento/src/lib/engine/score.ts`), not constants; they're the first thing to tune against the evaluation set.

## Building a day (`planDay`)

1. **Budget:** the pace sets the active minutes: relaxed 360, standard 480, packed 600.
2. **Filter:** drop on hard rules, with no scoring and no exceptions: closed that weekday or date, booking required and not held, stub coverage, unverified, or a category the traveller excluded ("no beaches" means never).
3. **Anchor:** seed the day with the best place that has a best time window (Fushimi Inari at 07:00 anchors the morning).
4. **Grow:** add the place that gains the most score for the least extra travel, until the time is spent or nothing helps.
5. **Order:** reorder to cut total travel time.
6. **Time:** set clock times from opening hours, train legs and meal slots, carrying slack forward.
7. **Validate:** re-check every hard rule on the finished day; on a failure, drop the offender and refill.

It's greedy insertion with local search: not optimal, and it doesn't need to be. It needs to be right, fast and explainable.

`planDay` returns timed stops with a reason each, meals, budget and slack, the day's cost, and **everything left out, with the term that removed it**. `planTrip` runs the days in order, so no place is used twice.

## Rules it keeps

- The anchor stays first through growing and ordering; timed pins are placed where the clock reaches them.
- A busy place that would miss its quiet window costs 30 minutes in ordering.
- Scores shown on stops are recomputed against the final order, so "your third temple today" is the third one shown.
- Hard rules live in `filter.ts` and never become penalties.
- It never invents a travel time. A place with no station costs a flat 45 minutes and a warning.
- **Known gaps:** opening windows are soft except for the anchor; season tags are optional and neutral when absent.

## Why not ask a model

It runs in milliseconds and costs nothing. It's unit-testable, so "Arashiyama and Fushimi Inari in one afternoon" becomes a failing test rather than a complaint. It produces the same plan twice for the same input. And because every clause of the reason traces to a term, the traveller can disagree with the reasoning, not just the result.

## Tests and tools

- Tests: `bento/src/lib/engine/__tests__/`, fixtures in `__fixtures__/kyoto.ts`. The traps must stay green:
  - Arashiyama and Fushimi Inari never share a day;
  - a Monday never fills with something closed on Mondays;
  - "no hiking" means never.
- Try it: `npx tsx scripts/plan-day.ts` (add a date, or `--pin kyt-sanjusangendo@10:00`).
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Engine (P4)".

Related: [division of labour](division-of-labour.md), [Japan rules](japan-rules.md), [transit](transit.md), [place data](place-data.md). Source: spec §05; `bento/README.md` "The engine".
