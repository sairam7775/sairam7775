---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/app/trips/[id]/trip-review.tsx
  - bento/src/lib/trips/review.ts
  - bento/supabase/migrations/0019_trip_reviews.sql
last_reviewed: 2026-11-13
---

# After the trip: "How did the plan hold up?"

## Summary

From a trip's last day on, a trip with a route asks the traveller how the plan held up: an outcome, the challenges they hit, and an optional note. It's how Bento learns where its plans fail, traced to the plan that caused it.

## User journey

1. On or after the trip's last day (UTC), the trip page shows the question.
2. The traveller picks an outcome and any challenges, and can add a note.
3. They can change the answer later, whatever happens to the trip afterwards.

## Acceptance criteria

- One answer per trip, owner only. A first answer is only possible once the trip has ended.
- The first answer saves **the plan as it stood**: the database makes this copy and keeps it through later changes, whatever a client sends. The app never sends a plan.
- Changing an answer is an update, not an upsert, because an upsert is also checked as an insert, which fails for a trip moved into the future.
- Outcome and challenge keys are fixed by check constraints, and kept equal in the database, `review.ts` and the copy by a test.
- Admins read answers and saved plans at `/admin/trip-reviews`, with no names or emails. Analytics get counts only, never the note.

## What it doesn't do

- Ask before the trip has ended, or let anyone but the owner answer.

## Code and tests

- `bento/src/app/trips/[id]/trip-review.tsx`, `bento/src/lib/trips/review.ts`, migration 0019.
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "After the trip".
