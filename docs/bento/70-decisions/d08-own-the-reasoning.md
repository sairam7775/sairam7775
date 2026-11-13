---
type: decision
status: accepted
date: 2026-09
---

# D8: AI strategy: own the reasoning, rent the language

## Context
A model that plans trips can silently drop a constraint, and the plan still looks fine.

## Decision
The engine (Bento's code) decides every fact, time and plan; the model handles intent and prose only. Opus 5 first; a cheaper model only once the evaluation holds.

## Consequences
Every number is computed, and a cheaper model becomes viable because the hard reasoning isn't in the model (see [division of labour](../30-software/division-of-labour.md)).

## Today
"Own the reasoning" is in effect. **"Opus 5 first" isn't followed at the moment:** the code's default provider is Anthropic, but production is set to Google's Gemini. Which model runs, and why, is in [Bento Man (software)](../30-software/bento-man.md).

Source: the original spec, §02 (decision D8). All decisions: [70-decisions](README.md).
