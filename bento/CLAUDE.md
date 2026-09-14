# Bento — working notes

A Japan trip planner. The design document is `../docs/spec.html`; it is the
source of truth for decisions, and section numbers below refer to it.

## The one idea that shapes everything

**We own the reasoning and rent the language** (§04). The recommender and day
scheduler are pure TypeScript. The language model handles intent parsing and
prose only.

The test for where something belongs is whether being wrong is visible. A badly
phrased sentence is obvious and harmless. A silently dropped constraint looks
like a working plan and strands someone. Everything in the second category
belongs in code.

Practically:

- Durations, fares, opening hours, travel times → the engine, always.
- The model may never state a fact it was not handed.
- The model proposes diffs; it never writes the itinerary directly.

## Invariants

- **Nothing unverified reaches a traveller.** Judgement fields on `places` are
  `NULL` until `verification_status = 'verified'`, enforced by the
  `places_public` view. Never query `places` directly from user-facing code.
- **RLS on every user table.** Never reach for the service-role client to work
  around a policy — if a query needs it, the policy is wrong.
- **Costs are stored in JPY.** Conversion happens on read, so a stale rate can
  never be baked into stored data.
- **Budget lives on `trip_cities`, not `trips`** — a ryokan night in Hakone
  must not make the Tokyo days score as overspending.
- **`excludes` is a hard filter**, applied before scoring. "No beaches" means
  never, not rarely.
- **Check the spend cap before any model call** (`assertWithinSpendCap`). It
  throws rather than returning a flag so a forgotten check cannot spend money.

## Engine rules (from P4)

- Pure functions in `src/lib/engine/`. No framework, no network, no model.
- Called from route handlers and server actions, never from components —
  this is also what keeps the React Native path open (§14).
- Unit-tested against fixtures, including the known traps: Arashiyama and
  Fushimi Inari must not land in the same day; a Monday must not fill with
  museums.

## Voice

Bento Man is a local friend who knows the place and will tell you the truth
about it (§04). Not a mascot. No enthusiasm as filler, no emoji in plan
content, no confident prose where a fact is missing. Warmth comes from
usefulness, not tone.

## Conventions

- Server Components by default; `"use client"` only where interaction needs it.
- Server actions for mutations, with Zod validation at the boundary.
- Tailwind v4 theme tokens in `globals.css` — use `text-ink-2`, `bg-surface`,
  `border-rule` rather than raw colours.
- `npm run typecheck` runs `next typegen` first; Next 16's `PageProps` and
  `LayoutProps` are generated, so bare `tsc` fails on a clean checkout.
