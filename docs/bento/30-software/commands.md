---
type: overview
status: accepted
code:
  - bento/package.json
  - bento/scripts/
last_reviewed: 2026-11-13
---

# Commands

Run in `bento/`.

| Command | Does |
|---|---|
| `npm ci` | Install the locked dependencies |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | Route type generation, then `tsc --noEmit`. Bare `tsc` fails on a clean checkout |
| `npm run lint` | ESLint |
| `npm test` | Vitest, once |
| `npm run mascot` | Rebuild Bento Man's animation files after changing the art |

**Before calling a change done:** `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all pass.

## Scripts

| Script | Does |
|---|---|
| `npx tsx scripts/plan-day.ts [date] [--pin id@HH:MM]` | Plans a day for the owner profile ([engine](engine.md)) |
| `npx tsx scripts/route.ts <from> <to>` | A route over the transit seed, without a database ([transit](transit.md)) |
| `npx tsx scripts/export-places-seed.ts` | Drafted places → `supabase/seed_places_draft.sql` ([curation](../50-operations/curation.md)) |
| `npx tsx scripts/export-transit-seed.ts` | Transit seeds → `supabase/seed_transit.sql` |
| `npx tsx scripts/eval-bento-man.ts [--only id]` | The Bento Man evaluation against a real model (costs quota; ask first) |
| `npx tsx scripts/grant-admin.ts <email>` | Grants curation access (needs the service-role key; ask the owner before using it on the live project) |
| `npx tsx scripts/import-geography.ts [--apply]` | Wikidata enrichment for seeded cities (dry run by default) |
| `npx tsx scripts/import-fx-rates.ts` | Exchange rates |
| `npx tsx scripts/draft-backgrounds.ts` | Drafts place backgrounds with Gemini, within the spend cap |
| `node scripts/render-icons.mjs` | Every logo and icon PNG ([logo](../20-design/logo.md)) |

The docs vault has its own check: `node tools/docs-check/check-docs.mjs` from the repo root.
