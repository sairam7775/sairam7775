---
type: runbook
status: accepted
code:
  - bento/src/lib/places/seed/
  - bento/scripts/export-places-seed.ts
  - bento/src/app/admin/
last_reviewed: 2026-11-13
---

# Curation: how place records are written and checked

## When to use it

Adding or correcting places for a city, or promoting a city's coverage.

## The pipeline (decision [D6](../70-decisions/d06-data-pipeline.md))

| Stage | Source | Produces | Gate |
|---|---|---|---|
| 1. Skeleton | Open data (Wikidata, OpenStreetMap, Wikivoyage), with attribution where required | Name, coordinates, category, prefecture, nearest station | Stub: visible immediately |
| 2. Draft | A model drafts the judgement fields from sources it's handed | Durations, best windows, crowd note, skip-if | **Hidden from travellers** |
| 3. Verify | A person reads, corrects and signs off in the admin pages | Verified by, last verified | Outline or deep |
| 4. Re-verify | A queue ordered by how often a place appears in real trips | Refreshed hours, prices, booking windows | Effort goes where travellers are |

**The rule that makes it safe:** a drafted judgement field is never shown to a traveller. Without this gate, AI drafting would bring back exactly the risk the product exists to avoid, at 2,000-record scale.

## Steps

1. Edit the city's drafts in `bento/src/lib/places/seed/<city>.ts`. Never edit the SQL.
   - A `station` must be a station id in the transit seed; a place reached only by bus or on foot gets `station: null` (and the engine's 45-minute fallback), or add the stop to the transit seed.
   - `conflicts` and `pairs` must point at ids in the same batch.
   - Hours are same-day: `closes` after `opens`. An overnight venue gets `closes: "23:59"`, with the real time in the tip.
   - Seasonal hours: store the **shortest** hours of the year with `hoursVary: true`.
   - Prices: `cost` is adult entry to the main paid part; change it only when the price moves to another band.
2. Generate the SQL: `npx tsx scripts/export-places-seed.ts > supabase/seed_places_draft.sql`. The exporter refuses duplicate ids and dangling links.
3. Load it as drafts. The upsert only touches rows still in draft, so a re-export can't overwrite a verified record.
4. **Sign off in `/admin/review`:** one draft at a time, every field on screen.
   - Check the durations against your sense of the place, the hours and cost against the listed source, and the tip for anything untrue.
   - `/admin/review/bulk` verifies many at once, by the same rule (a typical duration, a tag and a source), re-checked on the server.
5. **Review notes:** where the AI reviewers (Codex and Gemini) disagreed about a field, a note shows on the card. `/admin/review?notes=1` lists only places with open notes. A note never changes the place: the fix goes into the seed or the editor.
6. **Backgrounds:** check drafted backgrounds in `/admin/backgrounds`.
7. **Promote the city** on its `/admin/cities` page once it has enough verified places (deep 25, outline 8). Verifying never changes the tier by itself.

## How to check it worked

- The place shows its judgement fields to travellers only after verifying.
- The city's tier on its admin page matches its verified count.

## How to undo it

- Edit the record in the admin editor, or correct the seed and re-export (verified records are protected from the upsert).

## How often to refresh

| Data | Cadence | Why |
|---|---|---|
| Station-to-station times | Twice a year | Timetables barely move |
| Opening hours | Monthly | Seasonal shifts, occasional permanent change |
| Prices and fares | Quarterly | They change rarely |
| Booking release windows | Monthly | Policies change |
| Holidays and festivals | Yearly | Published a year ahead |
| Closures and disruptions | Never | A cached app can't know a line is down. Link to the official status and say so |

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Curation data (P5)". Source: spec §10; `bento/README.md` "Curation".
