---
type: design
status: accepted
code:
  - bento/src/lib/places/
  - bento/supabase/migrations/0027_place_backgrounds.sql
  - bento/supabase/migrations/0032_yearly_closures.sql
last_reviewed: 2026-11-20
---

# Place data: what "local guide" means in the data

A guidebook says *Fushimi Inari: famous for its torii gates*. A local says go before eight or the first gates are a queue; the full summit loop is three hours, and most people turn back at Yotsutsuji, which is fine. The second only exists if the data has fields for it, and if a person has signed those fields off.

## A place record

| Group | Fields | Notes |
|---|---|---|
| Facts | name (and Japanese name), city, coordinates, nearest station, category, cost, booking need, closed days (weekly, and dates every year), opening hours | Category drives redundancy scoring ([engine](engine.md)) |
| **Judgement fields** | durations (taste, typical, full), best time windows, crowd note, worth it if, skip if, signature score, conflicts with | **Hidden from travellers until the record is verified** |
| Provenance | verification status, verified by, last verified, sources | The honesty gate |

- `conflicts_with` stops the scheduler putting two places in one day (Arashiyama and Fushimi Inari, at opposite ends of Kyoto). It works place to place, so an area-wide rule is listed on every place in the area, on both sides.
- `verification_status` stops a drafted guess reaching a traveller.

## Rules

- **Nothing unverified reaches a traveller.** Judgement fields are empty until `verification_status = 'verified'`, enforced by the `places_public` view. User-facing code never reads `places` directly.
- **Seasonal hours are never promised.** A place whose hours change with the season stores the **shortest** hours of its year, with `hoursVary: true`. Travellers read "Usually open … hours change with the season, check before you go".
- **Closures that come every year** (migration 0032, `places.closed_yearly`, seed `closedYearly`) are month-day ranges: `["12-28..01-01"]` is 28 Dec to 1 Jan (an end before the start wraps the year), `"01-01"` one day. They are for the year-end break and the like, and only from the place's own published closing days; the seed comment names the page and the date it was read. A place whose site gives no dates gets none: shrines are usually open at New Year. Like the weekly closing days they are facts, shown whatever the verification status. Dates for one year only (`closed_dates`) are a different column.
- **Evening-only places** (migration 0033, `places.evening_only`, seed `eveningOnly`) are never planned before their evening. Set it only where the place's own notes say it is dead or closed by day (Pontocho, "Dead by day"); an evening best window alone stays a soft preference. A place that opens at 17:00 or later is treated so by its hours, flag or not. It is a fact, shown whatever the verification status.
- **Prices are bands, never figures:** free, under ¥500, ¥500–1,500, ¥1,500–3,000, over ¥3,000. The engine still uses the figure for a day's budget.
- **Backgrounds** (migration 0027) are a place's lasting story: history and what it's known for, 120–900 characters, never a clock time or a price. Only the service role writes them; an admin checks them; travellers and Bento Man read the checked ones only.

## Where the data lives

- `bento/src/lib/places/seed/<city>.ts` is the source of truth for drafted places, and each city's file is registered in `bento/src/lib/places/seed/index.ts`, which the exporter and the seed tests read. The SQL is generated from it (`bento/src/lib/places/export-sql.ts`), never edited by hand. Every seed record lands as a draft, and a re-export can't overwrite a record a person has verified. So a new fact that verified places need too goes in a migration that sets it by id, with the seed's values: 0032 does this for the year-end closures, and `bento/src/lib/db/yearly-closures.test.ts` keeps the migration and the seeds equal.
- How records are drafted and checked: [curation](../50-operations/curation.md).

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Invariants" and "Curation data (P5)". Source: spec §07; the place-backgrounds design (`docs/superpowers/specs/2026-10-23-place-backgrounds-design.md`).
