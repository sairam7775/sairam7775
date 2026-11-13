---
type: design
status: accepted
code:
  - bento/src/lib/places/
  - bento/supabase/migrations/0027_place_backgrounds.sql
last_reviewed: 2026-11-13
---

# Place data: what "local guide" means in the data

A guidebook says *Fushimi Inari: famous for its torii gates*. A local says go before eight or the first gates are a queue; the full summit loop is three hours, and most people turn back at Yotsutsuji, which is fine. The second only exists if the data has fields for it, and if a person has signed those fields off.

## A place record

| Group | Fields | Notes |
|---|---|---|
| Facts | name (and Japanese name), city, coordinates, nearest station, category, cost, booking need, closed days, opening hours | Category drives redundancy scoring ([engine](engine.md)) |
| **Judgement fields** | durations (taste, typical, full), best time windows, crowd note, worth it if, skip if, signature score, conflicts with | **Hidden from travellers until the record is verified** |
| Provenance | verification status, verified by, last verified, sources | The honesty gate |

- `conflicts_with` stops the scheduler putting two places in one day (Arashiyama and Fushimi Inari, at opposite ends of Kyoto).
- `verification_status` stops a drafted guess reaching a traveller.

## Rules

- **Nothing unverified reaches a traveller.** Judgement fields are empty until `verification_status = 'verified'`, enforced by the `places_public` view. User-facing code never reads `places` directly.
- **Seasonal hours are never promised.** A place whose hours change with the season stores the **shortest** hours of its year, with `hoursVary: true`. Travellers read "Usually open … hours change with the season, check before you go".
- **Prices are bands, never figures:** free, under ¥500, ¥500–1,500, ¥1,500–3,000, over ¥3,000. The engine still uses the figure for a day's budget.
- **Backgrounds** (migration 0027) are a place's lasting story: history and what it's known for, 120–900 characters, never a clock time or a price. Only the service role writes them; an admin checks them; travellers and Bento Man read the checked ones only.

## Where the data lives

- `bento/src/lib/places/seed/<city>.ts` is the source of truth for drafted places. The SQL is generated from it, never edited by hand. Every seed record lands as a draft, and a re-export can't overwrite a record a person has verified.
- How records are drafted and checked: [curation](../50-operations/curation.md).

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Invariants" and "Curation data (P5)". Source: spec §07; the place-backgrounds design (`docs/superpowers/specs/2026-10-23-place-backgrounds-design.md`).
