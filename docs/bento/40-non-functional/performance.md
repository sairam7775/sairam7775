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
| F3 | **The chat streams,** so the traveller sees text long before a long turn finishes. `/api/chat` may run up to 120 seconds, and a turn's model calls end by 75 seconds, so the reply is saved before the platform stops the function ([Bento Man (software)](../30-software/bento-man.md)) |
| F7 | **No request waits forever on the database:** every server-side Supabase client (`lib/supabase/timeout.ts`: the signed-in client, the service-role client, the proxy's session check, the email-link callback) gives a read 10 s and a write or RPC 15 s, then fails through the caller's usual error path. A cut-off read is not retried by postgrest-js. A write RPC that times out may have committed, so accepting a proposal or changing dates then says the outcome can't be confirmed, never that it failed ([proposals and diffs](../10-product/proposals-and-diffs.md)); a traveller never sees the timeout's own text |
| F4 | **The seasonal scene doesn't re-blur every frame:** no `filter` or `backdrop-filter` on anything that moves |
| F5 | **Fonts and art need no fetch at build or run time** (self-hosted fonts; the scenes and figure drawn in SVG and CSS; the animation player loaded only when needed) |
| F6 | Page-load and chat-response time targets: **not set yet** |

## How it's checked

- F1: the `x-vercel-id` response header includes `hnd1` (checked 13 November 2026).
- F2: engine tests run in milliseconds in `npm test`.
- F5: `npm run build` (no network fetch for fonts).
- F3, F7: unit tests with a fake clock and fake providers (`bento-man/__tests__/deadline.test.ts`, the provider tests) and a server that never answers (`supabase/timeout.test.ts`). Not yet checked against a real stalled provider or database.

## Evidence

- `bento/vercel.json` (`"regions": ["hnd1"]`); the move on 12 November 2026 ([region move](../50-operations/supabase-region-move.md)).

## Known gaps

- No measured targets for page load or chat response.
- Admin pages still show a database error's own text, a timeout's included ("AbortError: Supabase request timed out …"), and the service role has no statement timeout of its own, so an admin write or a spend hold that times out may still commit. A spend hold that commits late stays on the books until it ages out: the safe direction.
- The time limits bound one slow dependency, not several at once. If the session refresh, the spend holds and the save all stall in one turn, the limits add up and can pass 120 s. supabase-auth may also retry a stalled token refresh once more, within its own 30 s window. The 15 s write limit assumes Supabase's default 8 s statement timeout for signed-in requests, which was not checked on the live project. Without it, a slow RPC could commit after the client gave up, and the page would show a failure until it is reloaded.
- The Gemini free tier allows about 20 requests a day per model; heavy use moves down the fallback list ([Bento Man (software)](../30-software/bento-man.md)).
