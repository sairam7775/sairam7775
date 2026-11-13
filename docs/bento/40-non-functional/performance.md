---
type: non-functional
status: draft
implementation: partial
code:
  - bento/vercel.json
  - bento/src/lib/engine/
last_reviewed: 2026-11-13
---

# Performance

## Target

| # | Requirement |
|---|---|
| F1 | **The app runs next to its database:** the Vercel functions and the Supabase project are in the same region (Tokyo), because one chat turn makes several database round trips |
| F2 | **The engine plans in milliseconds** and costs nothing per run (pure code, no network) |
| F3 | **The chat streams,** so the traveller sees text long before a long turn finishes; `/api/chat` may run up to 120 seconds |
| F4 | **The seasonal scene doesn't re-blur every frame:** no `filter` or `backdrop-filter` on anything that moves |
| F5 | **Fonts and art need no fetch at build or run time** (self-hosted fonts; the scenes and figure drawn in SVG and CSS; the animation player loaded only when needed) |
| F6 | Page-load and chat-response time targets: **not set yet** |

## How it's checked

- F1: the `x-vercel-id` response header includes `hnd1` (checked 13 November 2026).
- F2: engine tests run in milliseconds in `npm test`.
- F5: `npm run build` (no network fetch for fonts).

## Evidence

- `bento/vercel.json` (`"regions": ["hnd1"]`); the move on 12 November 2026 ([region move](../50-operations/supabase-region-move.md)).

## Known gaps

- No measured targets for page load or chat response.
- The Gemini free tier allows about 20 requests a day per model; heavy use moves down the fallback list ([Bento Man (software)](../30-software/bento-man.md)).
