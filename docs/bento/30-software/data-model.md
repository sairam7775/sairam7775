---
type: design
status: accepted
code:
  - bento/supabase/migrations/
last_reviewed: 2026-11-13
---

# Data model rules

The tables are listed in [architecture](architecture.md); the exact schema is in the migrations, which win over this note.

## Rules

- **Costs are stored in yen.** Conversion happens on read, so a stale rate can never be baked into stored data (decision [D12](../70-decisions/d12-currency.md)).
- **The budget lives on `trip_cities`, not `trips`.** A ryokan night in Hakone mustn't make the Tokyo days score as overspending.
- **Every user table has row-level security.** If a query seems to need the service-role client to get past a policy, the policy is wrong ([security](../40-non-functional/security.md)).
- **Every user table cascades** from `auth.users` or from `trips` when an account is deleted. A new user table needs `on delete cascade` too. The exception is `api_usage`, which is unlinked and kept, because the spending cap sums it ([privacy](../40-non-functional/privacy.md)).
- **Changes that must happen together are one database function:** accepting a proposal (`apply_proposal`), changing dates (`update_trip_dates`), and both at once (`apply_proposal_with_dates`). Never add a second write after them from TypeScript.
- **Database limits** (migration 0029):
  - row caps per parent: 100 trips per account, and per trip 20 cities, 400 days, 300 bookings and 500 gap dismissals; 60 stops a day;
  - 90 nights a city, a year a trip;
  - a write allowance of 1 MB a statement and 10 MB in any 24 hours per account.

  A new user table gets the allowance triggers, and a cap if a page reads all its rows.
- **Booking times are wall-clock times at the place, stored as if UTC**; every reader formats in UTC. An unknown time is stored with a flag and shown as a date alone.
- Seed data (places, trains) comes from TypeScript sources; the SQL is generated, never edited by hand ([place data](place-data.md), [transit](transit.md)).

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Invariants".
