---
type: non-functional
status: draft
implementation: partial
code:
  - bento/vercel.json
  - bento/src/lib/engine/
  - bento/src/app/globals.css
  - bento/src/lib/analytics/web-vitals.ts
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
| F3 | **The chat streams,** so the traveller sees text long before a long turn finishes. `/api/chat` may run up to 120 seconds, and a turn's model calls end by 75 seconds, so the reply is saved before the platform stops the function ([Bento Man (software)](../30-software/bento-man.md)) |
| F4 | **The seasonal scene doesn't re-blur every frame:** no `filter` or `backdrop-filter` on anything that moves. Heavy shapes stay still, and a hidden tab pauses all of its animation |
| F5 | **Fonts and art need no fetch at build or run time** (self-hosted fonts; the scenes and figure drawn in SVG and CSS; the animation player loaded only when needed) |
| F6 | **Page-load budgets (Core Web Vitals, at the 75th percentile of real visits):** Largest Contentful Paint under 2.5 s, Interaction to Next Paint under 200 ms, Cumulative Layout Shift under 0.1. Chat-response time: not set yet |
| F7 | **The first screen's text is painted at once:** it never starts at opacity 0. It settles by movement only (`.settle`); `.up` (fade and rise) is for what comes after it |
| F8 | **A page reads what it needs at once:** reads that need only the trip's id start together, a later read waits only for the data it needs, and the trip, its route, its days and its bookings are each read once in a render (the trip page and Bookings; the planned places are still read twice, for their names and for their booking needs) |
| F9 | **No request waits forever on the database:** every server-side Supabase client (`lib/supabase/timeout.ts`: the signed-in client, the service-role client, the proxy's session check, the email-link callback) gives a read 10 s and a write or RPC 15 s, then fails through the caller's usual error path. A cut-off read is not retried by postgrest-js. A write RPC that times out may have committed, so accepting a proposal or changing dates then says the outcome can't be confirmed, never that it failed ([proposals and diffs](../10-product/proposals-and-diffs.md)); a traveller never sees the timeout's own text |

## How it's checked

- F1: the `x-vercel-id` response header includes `hnd1` (checked 13 November 2026).
- F2: engine tests run in milliseconds in `npm test`.
- F5: `npm run build` (no network fetch for fonts).
- F6: real visits report `web_vital` events (metric LCP, INP or CLS, its value and the browser's rating) to PostHog, only for visitors who allowed analytics (`lib/analytics/web-vitals.ts`, mounted in the root layout when the answer is yes). Nothing is sent from a document loaded as a shared plan (`/shared/…`), decided by the address the document loaded, so moving on to another page doesn't send them either (`loadedOnSharedPlan`). In the lab: Lighthouse, mobile, against a local production build (`next build` and `next start`).
- F7: `bento/src/app/first-paint.test.ts` checks that `.settle` has no opacity, is off under reduced motion, and is what each page's first text uses (home, app header, trips, plan, a trip and its vault, sign-in and sign-up, settings, legal and status pages).
- F8: by hand, with a local probe that logs each request to Supabase during a render (not in the repo). The trip page (`bento/src/app/trips/[id]/page.tsx`) waits on the sign-in check, then one round of reads (`readTrip`, `bento/src/app/trips/[id]/load-trip.ts`: the trip store's five, the chat, bookings, review, share, dismissed gaps), then the place names and the chat's cities, then the travel days, backgrounds and ticket needs together. The gap check (`gapsFrom`, `bento/src/lib/vault/store.ts`) takes the trip, route, days and bookings the page already read. Bookings (`bento/src/app/trips/[id]/vault/page.tsx`) reads the trip, route, days, bookings, rates and chat together. The graph is read once even when two loads start together (`loadGraph`).
- F3, F9: unit tests with a fake clock and fake providers (`bento-man/__tests__/deadline.test.ts`, the provider tests) and a server that never answers (`supabase/timeout.test.ts`). Not yet checked against a real stalled provider or database.

## Evidence

- `bento/vercel.json` (`"regions": ["hnd1"]`); the move on 12 November 2026 ([region move](../50-operations/supabase-region-move.md)).
- F7, 22 November 2026, Lighthouse mobile (simulated throttling), local production build, home page signed out, 5 runs each, medians: LCP 5.3 s → 4.5 s, element render delay 1.20 s → 0.85 s, FCP 1.85 s → 1.86 s (no change). The LCP element is still the hero paragraph. CLS went from 0 to about 0.02 on 4 of 5 runs: the hero text is now visible while its web font swaps in, so that shift now counts (still under the 0.1 budget). Sign-in already had LCP equal to FCP, so it showed no measurable change. Measured again after the font change (#113), main `af1e739` against this branch, 5 runs each, medians: LCP 4.19 s → 3.71 s, render delay 0.82 s → 0.61 s, FCP 1.23 s both; CLS 0.017 on 1 of 5 runs, 0 on the rest (one main run timed the loader as LCP and is the 1.23 s outlier).
- F8, measured 22 November 2026 on a local production build against the Tokyo project, a test account's trip with three cities: the trip page went from 21 requests to Supabase in 13 waits one after another to 17 requests in 5 (6 in a few renders, when one read finished early), and its median render from 600–680 ms to 440 ms. Bookings went from 14 requests in 7 waits to 11 in 5, and from 490 ms to 340 ms. One machine, shared with other work, so the times are rough; the request counts are exact.

## Known gaps

- **The home page doesn't meet the LCP budget in the lab yet.** The fade was a small part of it. The rest is the hero arriving late: the root `loading.tsx` streams a loader first and the page follows after `getUser()`, and the hero paragraph becomes the LCP again when its web font arrives (measured before the font change in #113).
- **The hero's font swap now counts as layout shift** (CLS about 0.02 in the lab): the text is visible in the fallback font and moves when Zen Kaku Gothic New arrives. Under budget; a fallback `@font-face` with `size-adjust` (and ascent/descent overrides) matched to Zen Kaku would remove most of it.
- **Real-visit numbers are per hard load:** one LCP, INP and CLS for each document Bento loads, not for each page reached by moving inside the app. None yet: `web_vital` events start with this change, and only from visitors who allowed analytics.
- A trip and its vault (signed-in pages) use `.settle` on their headers but were not measured in Lighthouse.
- Admin pages still show a database error's own text, a timeout's included ("AbortError: Supabase request timed out …"), and the service role has no statement timeout of its own, so an admin write or a spend hold that times out may still commit. A spend hold that commits late stays on the books until it ages out: the safe direction.
- A chat tool that makes several database reads can still take a turn past 120 s if two of them stall: each read is bounded, the tool is not.
- The time limits bound one slow dependency, not several at once. If the session refresh, the spend holds and the save all stall in one turn, the limits add up and can pass 120 s. supabase-auth may also retry a stalled token refresh once more, within its own 30 s window. The 15 s write limit assumes Supabase's default 8 s statement timeout for signed-in requests, which was not checked on the live project. Without it, a slow RPC could commit after the client gave up, and the page would show a failure until it is reloaded.
- No chat-response target.
- The Gemini free tier allows about 20 requests a day per model; heavy use moves down the fallback list ([Bento Man (software)](../30-software/bento-man.md)).
