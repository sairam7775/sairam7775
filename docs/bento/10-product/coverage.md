---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/app/admin/actions.ts
  - bento/src/lib/bento-man/context.ts
last_reviewed: 2026-11-13
---

# Coverage: honest about how well Bento knows a place

## Summary

The target is every destination in Japan, about 2,000 records (decision [D2](../70-decisions/d02-whole-japan.md)). Curating that takes months, so coverage is **tiered**, and the tier is shown to the traveller and given to the planner. Bento covers all of Japan; it simply tells the truth about how well.

## Tiers

| Tier | Means | What the planner does |
|---|---|---|
| **deep** | 25+ verified places | Builds whole day plans |
| **outline** | 8+ verified places | Suggests places; won't claim a day is complete |
| **stub** | Name and location only | Says plainly it doesn't know the place well enough yet |

**The tier is enforced:** the admin page refuses to promote a city without enough verified places (`MIN_VERIFIED_FOR` in `bento/src/app/admin/actions.ts`: deep 25, outline 8). Verifying places never changes a city's tier by itself; promoting is a separate step on the city page.

*The original spec set deep at 40+ places and outline at 10–20. The code's numbers (25 and 8) are what apply (manifest contradiction C6).*

## Today

- **Planned in depth:** Kyoto, Osaka, Nara, Hiroshima, Miyajima and Himeji (an en-route stop), the Kansai–Sanyo corridor, plus Tokyo.
- **Everything else** exists with less depth, and Bento says so.

## Acceptance criteria

- A traveller always sees how well Bento knows each city, in the same words in the city chips and from Bento Man.
- Bento Man never says "tier" or "stub". The model is told coverage in the chips' words (`coverageWords`), and replies that use internal words fail the voice check.
- A city can't be promoted beyond what its verified places support.
- The planner never builds a full day plan for a city that isn't deep.

## What it doesn't do

- It doesn't hide thin coverage behind a plan that looks complete. That "silent thinness" (a Takayama plan that looks like the Kyoto one but rests on four records and a guess) is the most damaging thing this product could do.

## Failure behaviour

- For a city Bento doesn't know well, Bento Man says so ("I don't know Takayama well enough yet to plan your days there") and doesn't invent days.

## Code and tests

- Promotion rules: `bento/src/app/admin/actions.ts`.
- The words travellers see: `copy.coverage` in `bento/src/copy/en.ts`; `city_coverage` is the traveller-safe view.
- Curation work behind the tiers: [curation](../50-operations/curation.md).

Source: spec §06; `bento/README.md` "Coverage tiers".
