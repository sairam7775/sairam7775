---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/lib/bento-man/diff.ts
  - bento/src/app/trips/[id]/proposal-card.tsx
  - bento/supabase/migrations/0015_atomic_trip_edits.sql
  - bento/supabase/migrations/0016_date_proposals.sql
last_reviewed: 2026-11-13
---

# Proposals and diffs

## Summary

The failure of every chat-based planner: the traveller spends an hour refining a plan, asks for one change, and everything regenerates, so their edits vanish. Bento's plan is **structured data, never chat text**. Bento Man never rewrites it. He asks the engine, and the engine returns a **proposal**: a change shown as a diff, which the traveller accepts or rejects.

## User journey

1. The traveller asks for something ("too many temples on the 23rd", "be at Sanjusangen-do at 10", "add a night in Nara").
2. Bento Man calls the engine and shows a proposal card. Each stop is marked **kept**, **new**, **moved** or **out**, with what was left out and why.
3. The traveller presses **Accept** or **Reject**. Nothing changes before that.
4. Accepting applies the whole proposal at once. Pinned stops stay where they are.

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

- A proposal that would put a stop on a day it's closed, or a ticketed stop on a day with no ticket, is refused with the reason.
- If the trip changed since the proposal was made (another tab, another change), accepting is refused rather than applied twice.
- Each proposal is checked on its way into the conversation log and again on its way out.

## Code and tests

- The proposal format and checks: `bento/src/lib/bento-man/diff.ts`.
- The card: `bento/src/app/trips/[id]/proposal-card.tsx`.
- The database steps: migrations 0015, 0016 and 0028 (`update_trip_dates` refuses a trip that moved meanwhile).
- The rules agents keep are in [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Bento Man (P6)".

## Related decisions

- [D8: own the reasoning, rent the language](../70-decisions/d08-own-the-reasoning.md)
