---
type: non-functional
status: draft
implementation: partial
code:
  - bento/vercel.json
  - bento/src/lib/engine/
  - bento/src/app/trips/[id]/page.tsx
  - bento/src/lib/vault/store.ts
last_reviewed: 2026-11-22
---

# Performance

## Target

| # | Requirement |
|---|---|
| F1 | **The app runs next to its database:** the Vercel functions and the Supabase project are in the same region (Tokyo), because one chat turn makes several database round trips |
| F2 | **The engine plans in milliseconds** and costs nothing per run (pure code, no network) |
| F3 | **The chat streams,** so the traveller sees text long before a long turn finishes; `/api/chat` may run up to 120 seconds |
| F4 | **The seasonal scene doesn't re-blur every frame:** no `filter` or `backdrop-filter` on anything that moves. Heavy shapes stay still, and a hidden tab pauses all of its animation |
| F5 | **Fonts and art need no fetch at build or run time** (self-hosted fonts; the scenes and figure drawn in SVG and CSS; the animation player loaded only when needed) |
| F6 | Page-load and chat-response time targets: **not set yet** |
| F7 | **A page reads what it needs at once:** reads that need only the trip's id start together, a later read waits only for the data it needs, and nothing is read twice in one render (the trip page and Bookings) |

## How it's checked

- F1: the `x-vercel-id` response header includes `hnd1` (checked 13 November 2026).
- F2: engine tests run in milliseconds in `npm test`.
- F5: `npm run build` (no network fetch for fonts).
- F7: by hand, with a local probe that logs each request to Supabase during a render (not in the repo). The trip page (`bento/src/app/trips/[id]/page.tsx`) waits on the sign-in check, then one round of reads (the trip store's five, the chat, bookings, review, share, dismissed gaps), then the place names and the chat's cities, then the travel days, backgrounds and ticket needs together. The gap check (`gapsFrom`, `bento/src/lib/vault/store.ts`) takes the trip, route, days and bookings the page already read. Bookings (`bento/src/app/trips/[id]/vault/page.tsx`) reads the trip, route, days, bookings, rates and chat together. The graph is read once even when two loads start together (`loadGraph`).

## Evidence

- `bento/vercel.json` (`"regions": ["hnd1"]`); the move on 12 November 2026 ([region move](../50-operations/supabase-region-move.md)).
- F7, measured 22 November 2026 on a local production build against the Tokyo project, a test account's trip with three cities: the trip page went from 21 requests to Supabase in 13 waits one after another to 17 requests in 5 (6 in a few renders, when one read finished early), and its median render from 600–680 ms to 440 ms. Bookings went from 14 requests in 7 waits to 11 in 5, and from 490 ms to 340 ms. One machine, shared with other work, so the times are rough; the request counts are exact.

## Known gaps

- No measured targets for page load or chat response.
- The Gemini free tier allows about 20 requests a day per model; heavy use moves down the fallback list ([Bento Man (software)](../30-software/bento-man.md)).
