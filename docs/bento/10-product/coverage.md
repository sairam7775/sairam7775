---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/app/admin/actions.ts
  - bento/src/lib/bento-man/context.ts
  - bento/src/lib/bento-man/tools.ts
  - bento/src/lib/trips/route-card.ts
last_reviewed: 2026-11-14
---

# Coverage: honest about how well Bento knows a place

## Summary

The target is every destination in Japan, about 2,000 records (decision [D2](../70-decisions/d02-whole-japan.md)). Curating that takes months, so coverage is **tiered**, and the tier is shown to the traveller and given to the planner. Bento covers all of Japan; it simply tells the truth about how well.

## Tiers

| Tier | Means | What the planner does |
|---|---|---|
| **deep** | 25+ verified places | Builds day plans |
| **outline** | 8+ verified places | Builds day plans from the places it has, and labels each as planned from the main sights (see below) |
| **stub** | Name and location only | Refuses to plan, and says plainly it doesn't know the place well enough yet |

*The original spec meant outline cities to get suggestions only, never a "complete" day plan. The owner decided (Q12 in [open questions](../00-start/open-questions.md)) to keep planning those days and to say what they are. A planned day in an outline city carries one line, "Planned from the main sights here. There may be more worth adding." (`copy.mainSightsDay`), on the proposal card, in the day box and on the downloaded sheet. On the companions' shared sheet it shows only for days in a city on the route, not yet for a day trip off the route (Q16, below). The line follows the city's coverage when the page is shown (`showsMainSights` in `bento/src/lib/trips/route-card.ts`); nothing extra is stored on a proposal or a day. The `plan_days` and `replan_day` results for such a day (`bento/src/lib/bento-man/tools.ts`) carry `coverage: "main sights only"` and the same line, with the instruction never to call the day complete or full, so Bento Man says what the page says. A well-covered day's tool result is unchanged byte for byte (`tools.test.ts`). Stub cities are still refused.*

*A saved day's coverage comes from the day's own city, read with the day (`itinerary_days` joined to `cities` in `SupabaseStore`; `dayCoverage` in `bento/src/lib/bento-man/trip-view.ts`), not from whether that city is on the route. So a day trip to Miyajima from Hiroshima reads "Miyajima · Main sights only", keeps Re-plan and carries the line, in the day box and the download. The companions' shared sheet still takes coverage from the route's cities only, because `shared_trip()` returns no coverage for a day's own city: on-route days are labelled there, off-route day trips are not (and show the city's id rather than its name), until the sharing function returns each day's city name and coverage. That needs a reviewed migration of a security-definer function anonymous visitors can call, so it is listed as Q16 in [open questions](../00-start/open-questions.md); `shared-plan.test.ts` pins today's behaviour.*

**The tier is enforced:** the admin page refuses to promote a city without enough verified places (`MIN_VERIFIED_FOR` in `bento/src/app/admin/actions.ts`: deep 25, outline 8). Verifying places never changes a city's tier by itself; promoting is a separate step on the city page.

*The original spec set deep at 40+ places and outline at 10–20. The code's numbers (25 and 8) are what apply (manifest contradiction C6).*

## Today

- **Planned in depth:** Kyoto, Osaka, Nara, Hiroshima, Miyajima and Himeji (an en-route stop), the Kansai–Sanyo corridor, plus Tokyo.
- **Everything else** exists with less depth, and Bento says so.

## Acceptance criteria

- A traveller always sees how well Bento knows each city, in the same words in the city chips and from Bento Man.
- Bento Man never says "tier" or "stub". The model is told coverage in the chips' words (`coverageWords`), and replies that use internal words fail the voice check.
- A city can't be promoted beyond what its verified places support.
- The planner never builds a day plan for a stub city.
- A planned day in an outline city says it was planned from the main sights, in the same line on the proposal card, the day box and the downloaded sheet (on the shared sheet, for days in a route city only: Q16), and Bento Man doesn't call it complete (eval scenario `days-main-sights`).

## What it doesn't do

- It doesn't hide thin coverage behind a plan that looks complete. That "silent thinness" (a Takayama plan that looks like the Kyoto one but rests on four records and a guess) is the most damaging thing this product could do.

## Failure behaviour

- For a city Bento doesn't know well, Bento Man says so ("I don't know Takayama well enough yet to plan your days there") and doesn't invent days.

## Code and tests

- Promotion rules: `bento/src/app/admin/actions.ts`.
- The words travellers see: `copy.coverage` in `bento/src/copy/en.ts`; `city_coverage` is the traveller-safe view.
- Curation work behind the tiers: [curation](../50-operations/curation.md).

Source: spec §06; `bento/README.md` "Coverage tiers".
