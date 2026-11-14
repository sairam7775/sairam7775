---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/lib/bento-man/
  - bento/src/app/trips/[id]/chat.tsx
last_reviewed: 2026-11-13
---

# Bento Man, the guide

## Summary

Bento Man is the guide a traveller talks to on each trip page. He asks what kind of trip it is, proposes a route and days, and explains the plan. **Everything he can do is what his tools can do**, and every tool calls Bento's engine or database: he never touches the plan himself, and never states a fact he wasn't handed ([division of labour](../30-software/division-of-labour.md)).

## User journey

1. On a trip page, the conversation panel is on the right. A first message may be waiting from "Plan a Japan trip", the guided start; nothing is sent until the traveller presses Send.
2. Up to seven skippable onboarding questions. The answers are stored where the traveller can read and correct them, never inferred silently.
3. A route: Bento Man checks it first. Five cities in nine nights comes back over-packed, with the arithmetic (nights per city, two hours per city change, hours on trains, the share of waking time spent moving).
4. Days, changes ("too many temples on the 23rd", "be at Sanjusangen-do at 10") and date moves all come back as [proposals](proposals-and-diffs.md) to accept or reject.
5. Asked about a place, he quotes the verified record and the journey from the database, not the model's memory. For a place's history only, he may retell a checked background, or give two or three sentences of widely known background, said as general. Culture that doesn't go out of date (etiquette, what a torii is, festivals) he answers from what he knows; anything that changes, such as entry or visa rules, he points to the official source.

## Acceptance criteria

- No plan change happens without a proposal the traveller accepts.
- An over-packed route is refused with the arithmetic before it can be proposed. If the traveller insists, the card warns and reads **Accept anyway**.
- Moving dates the trip already has is a proposal, unless the traveller allowed date changes without asking. Only the traveller can grant that; the model can't.
- He never says "tier" or "stub", and never uses emoji in plan content ([voice](../20-design/voice.md)).
- Hours, prices and anything a traveller acts on come only from the database.
- He talks about Japan travel only: other topics are declined in a line and turned back to Japan. Nothing a traveller types changes his rules or reveals his instructions ([Bento Man (software)](../30-software/bento-man.md)).
- Before every model call, a spend hold is taken; a turn ends politely when none is left ([costs](../40-non-functional/costs.md)).

## What it doesn't do

- Edit the plan directly, fetch anything from the web, or answer from the model's general knowledge about hours, prices or logistics.

## Failure behaviour

- When the AI budget or rate limit is reached, the turn ends politely, and nothing is charged twice.
- If the model is busy or over its free quota, Bento moves to the next model in its fallback list ([Bento Man (software)](../30-software/bento-man.md)).

## Code and tests

- How it's built, the tools, the models and the evaluation: [Bento Man (software)](../30-software/bento-man.md).
- His look: [Bento Man's figure](../20-design/bento-man-figure.md).
