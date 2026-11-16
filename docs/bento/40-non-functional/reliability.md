---
type: non-functional
status: draft
implementation: partial
code:
  - bento/supabase/migrations/0015_atomic_trip_edits.sql
  - bento/src/lib/bento-man/provider.ts
  - bento/src/app/api/cron/
last_reviewed: 2026-11-13
---

# Reliability

## Target

| # | Requirement |
|---|---|
| R1 | **No half-applied plan:** accepting a proposal and changing dates are each one database step, refused if the trip changed meanwhile ([proposals and diffs](../10-product/proposals-and-diffs.md)) |
| R2 | **Never show success that didn't happen:** every write's result is checked, and the traveller is told when it failed |
| R3 | **The model failing doesn't break planning:** busy-server errors are retried twice before anything has streamed; quota or lasting overload moves to the next model; the budget running out ends the turn politely |
| R4 | **Account deletion finishes even if analytics deletion fails:** a queued retry runs daily, up to ten times, and the person is told the truth |
| R5 | **A sign-in limiter that can't answer refuses the attempt** (fail closed), so a database problem never removes the limits |
| R6 | A database backup and restore procedure: **not written yet** |

## How it's checked

- Database functions tested on PGlite before being applied (migrations 0015, 0028, 0029, 0030).
  - 0030 (`renew_trip_share`): all migrations replayed on one PGlite connection, run as the owner, another account, no account and `anon`, including a forced insert failure and the "until the trip ends" re-check. Two renews were run one after another only: PGlite has one connection, so renews really at the same moment, and a renew meeting a trip deletion, were not exercised.
- Unit tests for the provider's retry and fallback: `bento/src/lib/bento-man/__tests__/provider.gemini.test.ts`.
- `knowledge/checklists/verification.md` (shared knowledge base) for every change.

## Evidence

- Migrations `0015_atomic_trip_edits.sql`, `0016_date_proposals.sql`, `0028_trip_dates_guard.sql`, `0030_renew_trip_share.sql`.
- The analytics-deletion retry: `bento/src/app/api/cron/` (Vercel cron, needs `CRON_SECRET`).

## Known gaps

- No backup or restore runbook. Supabase's free plan has limited backups; check the plan before relying on it.
- No uptime or error-rate target, and no alerting beyond Vercel's and Supabase's dashboards.
