---
type: overview
status: accepted
last_reviewed: 2026-11-13
---

# Risks

Product, engineering, legal and safety risks. Commercial risks (such as retention and distribution) are tracked in the private vault ([decision D7](../70-decisions/d07-risk-framing.md)).

## Engineering

| Risk | Likelihood / impact | What happens | What Bento does |
|---|---|---|---|
| Curation upkeep at scale | High / high | Records go stale, and the product is visibly wrong within a year; wrong is the one thing Bento sells against | The draft-and-verify pipeline; a re-verify queue by usage; last-verified dates ([curation](../50-operations/curation.md)) |
| Uncapped AI spend | Medium / high | A loop bug or a scraper runs up a large bill overnight | A hard monthly cap, per-user rate limits and spend holds before every call ([costs](../40-non-functional/costs.md)) |
| Transit data complexity | Medium / medium | Japanese transit data is large and inconsistent | Hand-built networks for the cities Bento plans ([transit](../30-software/transit.md)) |
| Wrong logistics | Low / high | A traveller misses a train; one incident destroys trust | The engine owns every number; the model may not state a fact it wasn't handed |
| Model behaviour drift | Low / medium | Prompts tuned to one model behave differently on another | Proposals checked against a schema; the evaluation is the regression check ([Bento Man (software)](../30-software/bento-man.md)) |

## Legal and safety

| Risk | Likelihood / impact | What happens | What Bento does |
|---|---|---|---|
| Accessibility claims | Medium / high | "Step-free" that isn't strands a wheelchair user | No such claim until it's verified per place; until then the field is absent, not guessed |
| Booking-data sensitivity | Low / high | A reference and a surname can cancel someone's flight | Encrypted at rest, never logged or put in a prompt, row-level security ([security](../40-non-functional/security.md)) |
| Prompt injection through pasted bookings | Low / medium | A malicious paste steers a model with tools | Pasted text is read in a separate call with no tools |
| Prompt injection through the chat | Medium / low | A traveller talks Bento Man off topic or into repeating his instructions | Prompt rules backed by code: hidden characters and forged trip-state tags removed, a repeated prompt withheld; tools reach only the traveller's own trip ([Bento Man (software)](../30-software/bento-man.md)) |
| Open-data licences | Low / medium | Attribution or redistribution terms broken | Sources recorded per record; ODPT not used because of its licence |

Source: spec §15.
