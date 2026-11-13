---
type: overview
status: accepted
last_reviewed: 2026-11-13
---

# Vision

## The product in one paragraph

Bento looks like one chat box, but it's three products stacked, and they aren't equally hard:

| Layer | What it does | Who owns it |
|---|---|---|
| **Bento Man** | The guide the traveller talks to. Understands what kind of trip this is, asks useful follow-up questions, and explains the plan in words a first-timer can act on | Rented: a language model, for language only |
| **The planner** (recommender and scheduler) | Scores every place for this traveller, then builds days that respect opening hours, closures, travel time and pace. Deterministic, testable, explainable | Bento's own code, [the engine](../30-software/engine.md) |
| **The booking vault** | Bookings the traveller adds, matched to nights and legs, with a detector that names what's still missing in plain words | Bento's own code, the [booking vault](booking-vault.md) |

## The bet

Anyone can generate a Japan itinerary. Almost nobody generates one where the travel times are worked out, the constraints hold, and the plan admits what it doesn't know. Bento competes on being **correct and candid**, and correctness lives in code Bento owns, not in a model it rents ([division of labour](../30-software/division-of-labour.md)).

## Who it's for

First-time and returning visitors to Japan who want a plan they can trust on the ground, and an honest answer when Bento doesn't know a place well enough ([coverage](coverage.md)).

The first traveller was the owner: the product was designed against a real person's preferences rather than an invented persona (decision [D5](../70-decisions/d05-user-zero.md)). The profile itself is kept privately.

## What "good" looks like

- A plan where every number (a time, a fare, a duration) was computed, not written by a model.
- Thin coverage is said out loud, never hidden behind a plan that looks complete.
- A change asked for in conversation changes only that part of the plan ([proposals and diffs](proposals-and-diffs.md)).
- The traveller can see why each stop is there, and disagree with the reasoning, not just the result.

Source: the original spec, §01 ([archive](../90-archive/README.md)).
