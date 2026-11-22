---
type: non-functional
status: draft
implementation: partial
code:
  - bento/vercel.json
  - bento/src/lib/engine/
  - bento/src/app/globals.css
  - bento/src/lib/analytics/web-vitals.ts
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
| F6 | **Page-load budgets (Core Web Vitals, at the 75th percentile of real visits):** Largest Contentful Paint under 2.5 s, Interaction to Next Paint under 200 ms, Cumulative Layout Shift under 0.1. Chat-response time: not set yet |
| F7 | **The first screen's text is painted at once:** it never starts at opacity 0. It settles by movement only (`.settle`); `.up` (fade and rise) is for what comes after it |

## How it's checked

- F1: the `x-vercel-id` response header includes `hnd1` (checked 13 November 2026).
- F2: engine tests run in milliseconds in `npm test`.
- F5: `npm run build` (no network fetch for fonts).
- F6: real visits report `web_vital` events (metric LCP, INP or CLS, its value and the browser's rating) to PostHog, only for visitors who allowed analytics (`lib/analytics/web-vitals.ts`, mounted in the root layout when the answer is yes) and never on a shared plan. In the lab: Lighthouse, mobile, against a local production build (`next build` and `next start`).
- F7: `bento/src/app/first-paint.test.ts` checks that `.settle` has no opacity, is off under reduced motion, and is what each page's first text uses.

## Evidence

- `bento/vercel.json` (`"regions": ["hnd1"]`); the move on 12 November 2026 ([region move](../50-operations/supabase-region-move.md)).
- F7, 22 November 2026, Lighthouse mobile (simulated throttling), local production build, home page signed out, 5 runs each, medians: LCP 5.3 s → 4.5 s, element render delay 1.20 s → 0.85 s, FCP 1.85 s → 1.86 s (no change). The LCP element is still the hero paragraph. CLS went from 0 to about 0.02 on 4 of 5 runs: the hero text is now visible while its web font swaps in, so that shift now counts (still under the 0.1 budget). Sign-in already had LCP equal to FCP, so it showed no measurable change.

## Known gaps

- **The home page doesn't meet the LCP budget in the lab yet.** The fade was a small part of it. The rest is the hero arriving late: the root `loading.tsx` streams a loader first and the page follows after `getUser()`, and the hero paragraph becomes the LCP again when its web font arrives (18 font files on the home page).
- No real-visit numbers yet: `web_vital` events start with this change, and only from visitors who allowed analytics.
- No chat-response target.
- The Gemini free tier allows about 20 requests a day per model; heavy use moves down the fallback list ([Bento Man (software)](../30-software/bento-man.md)).
