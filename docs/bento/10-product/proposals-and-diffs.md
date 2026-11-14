---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/lib/bento-man/diff.ts
  - bento/src/app/trips/[id]/proposal-card.tsx
  - bento/supabase/migrations/0015_atomic_trip_edits.sql
  - bento/supabase/migrations/0016_date_proposals.sql
  - bento/supabase/migrations/0031_stale_proposals.sql
last_reviewed: 2026-11-14
---

# Proposals and diffs

## Summary

The failure of every chat-based planner: the traveller spends an hour refining a plan, asks for one change, and everything regenerates, so their edits vanish. Bento's plan is **structured data, never chat text**. Bento Man never rewrites it. He asks the engine, and the engine returns a **proposal**: a change shown as a diff, which the traveller accepts or rejects.

## User journey

1. The traveller asks for something ("too many temples on the 23rd", "be at Sanjusangen-do at 10", "add a night in Nara").
2. Bento Man calls the engine and shows a proposal card. Each stop is marked **kept**, **new**, **moved** or **out**, with what was left out and why.
3. The traveller presses **Accept** or **Reject**. Nothing changes before that.
4. Accepting applies the whole proposal at once. Pinned stops stay where they are.
5. If it was the trip's **first route** (the trip had no cities before), the traveller is taken to the [booking vault](booking-vault.md) next, where Bento Man suggests what to book. Every later proposal leaves them on the plan.

## Acceptance criteria

- A proposal changes nothing until the traveller accepts it.
- An accepted proposal is applied as **one database step** (`apply_proposal`, migration 0015). It succeeds or fails as a whole, with no half-applied plan.
- Moving dates the trip already has is a proposal too, unless the traveller allowed date changes without asking. Accepting a date change together with the rest is also one step (`apply_proposal_with_dates`, 0016), refused if the trip changed since it was proposed.
- A pinned stop survives re-planning.
- Each stop's reason is built from the engine terms that moved its score ([engine](../30-software/engine.md)), so the sentence is true by construction.
- An over-packed route is a conversation first: it's refused with the arithmetic. If the traveller insists, the card says it's over-packed and the button reads **Accept anyway**.

## What it doesn't do

- The model never writes to the itinerary tables. `acceptProposal` is the only writer of route and day changes from the chat.
- It doesn't regenerate untouched days.

## Failure behaviour

- A **date change** that would put a planned stop on a day it's closed, or a ticketed stop on a day with no ticket, is refused with the reason (`shift.ts`). Accepting other proposals doesn't re-check those rules; the engine checked them when it made the proposal.
- A date proposal is refused if the trip's dates changed since it was proposed, and a proposal can't be accepted twice.
- Day proposals record the ordered stops, pins, times, durations and arrival details they were planned from. Accept checks that snapshot inside the database, under the same trip lock as hand edits. If any day differs, the whole proposal is set aside: no route or day changes, and that card closes. This also catches a suggestion saved after a hand edit but computed before it. The traveller is asked to request a fresh plan.
- **Remaining gap (Q13):** legacy proposals without a snapshot remain acceptable. Combined date-and-day proposals retain their previous behaviour: days may have been planned before or after the proposed date shift, so the original date per day must be recorded before they can be checked soundly. These can still overwrite a hand edit.
- Each proposal is checked on its way into the conversation log and again on its way out.

## Code and tests

- The proposal format and checks: `bento/src/lib/bento-man/diff.ts`.
- The card: `bento/src/app/trips/[id]/proposal-card.tsx`.
- The database steps: migrations 0015, 0016, 0028 (`update_trip_dates` refuses a trip that moved meanwhile), and 0031 (day snapshots). The void acceptance RPC persists `resolution_reason = 'stale_day'` on a rejected message and returns normally, so the close commits; the store reads that outcome and shows the copy-file sentence. SQL execution and concurrent acceptance require separate Postgres verification; text tests only check the migration's structure.
- The rules agents keep are in [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Bento Man (P6)".

## Related decisions

- [D8: own the reasoning, rent the language](../70-decisions/d08-own-the-reasoning.md)
