---
type: decision
status: accepted
date: 2026-09
---

# D9: Party model: one profile per trip

## Context
Groups travel together, and modelling each traveller separately is expensive to build.

## Decision
One shared preference profile per trip, plus the party size. Trips own the profile, so per-traveller profiles can be added later.

## Consequences
Simple to build; per-person profiles stay possible.

## Today
**Differs from the code:** `user_preferences` is keyed by the account (`user_id`), not by the trip, while `trips.party_size` exists. Listed in [open questions](../00-start/open-questions.md).

Source: the original spec, §02 (decision D9). All decisions: [70-decisions](README.md).
