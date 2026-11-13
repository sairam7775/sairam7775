---
type: design
status: accepted
code:
  - bento/src/lib/engine/
  - bento/src/lib/bento-man/
last_reviewed: 2026-11-13
---

# Division of labour: own the reasoning, rent the language

Decision [D8](../70-decisions/d08-own-the-reasoning.md) shapes everything else. **The test for where something belongs is whether being wrong is visible:**
- a badly phrased sentence is obvious and harmless;
- a silently dropped constraint looks like a working plan and strands someone.

Everything in the second category belongs in code.

| The engine decides (deterministic, unit-tested, free to run) | The model decides (probabilistic, evaluated, rented) |
|---|---|
| Which places are candidates for this traveller | What "somewhere quiet, not too touristy" means as tags |
| What order they go in, and at what times | Which follow-up question is worth asking next |
| Whether two places conflict in a day | How to phrase a reason the engine already computed |
| Travel time, mode, fare and platform | How to read a booking confirmation the traveller pasted |
| Whether a day is over-packed | When to say it doesn't know |
| What's missing from the bookings | |
| **Every number shown anywhere in the product** | |

## The rules that keep it honest

- **The model may never state a fact it wasn't handed.** Times, fares, hours and durations come from the engine and are passed to the model as data. If the engine didn't compute it, Bento doesn't claim it.
- **The model proposes changes; it never writes the itinerary directly.** See [proposals and diffs](../10-product/proposals-and-diffs.md).
- Durations, fares, opening hours and travel times always come from the engine.

How Bento Man talks is in [voice](../20-design/voice.md). The model setup is in [Bento Man (software)](bento-man.md).

## Current state

- The engine is pure TypeScript in `bento/src/lib/engine/`, with no framework, network or model, called only from server code. That also keeps a future mobile app possible ([mobile](../60-direction/mobile.md)).
- Bento Man's tools call the engine and the database; the model only fills in tool inputs and writes the prose.
- The rules agents must keep are in [bento/CLAUDE.md](../../../bento/CLAUDE.md) ("The one idea that shapes everything").

Source: the original spec, §04; `bento/README.md` "Two rules the code holds to".
