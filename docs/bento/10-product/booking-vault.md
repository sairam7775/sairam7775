---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/lib/vault/
  - bento/src/app/trips/[id]/vault/
  - bento/src/app/api/parse-booking/
last_reviewed: 2026-11-13
---

# The booking vault and gaps

## Summary

The traveller keeps their bookings in the trip's **vault** (flights, hotels, trains, tickets, restaurants and anything else), and Bento **names what's still missing**, in plain sentences. Bookings are only ever what the traveller adds: nothing is fetched from an airline or hotel. That removes sign-in with third parties, scraping and most of the security risk in one decision, and leaves the gap detector as pure logic over the traveller's own data.

## User journey

1. On a trip, the traveller opens the vault (`/trips/<id>/vault`).
2. They add a booking: type it in, or paste a confirmation and let Bento fill the form for them to check.
3. A ribbon shows one bar per night, solid where covered and hatched where not. Under it, sentences such as: "You have nowhere to sleep on the night of 26 November. Your Kyoto hotel runs through the 25th and the next booking starts on the 27th."
4. They can drag a booking into one of its days, where it sits as a fixed block at its booked time.
5. A gap they've seen and chosen to live with can be dismissed. It's kept, not deleted.

## Acceptance criteria

- **Three things must stay covered:** every night needs a bed, every city change needs a way to get there, every timed-entry place needs a ticket.
- **Gap severity:**
  - **blocking:** the trip doesn't work (a night with no bed; a required ticket not held, whatever its window);
  - **closing:** a recommended booking's window is running out;
  - **worth knowing:** probably fine.
- The detector tells "never needed a booking" from "not booked yet". A temple with no ticket isn't a gap.
- Consecutive uncovered nights are one gap per city, not one per night; a run crossing cities is split, so each names its city.
- A gap's key is stable between runs, because dismissals are stored against it.
- Whether a booking covers a place's ticket uses one shared rule for the gap detector and the planner, so they never disagree: a linked place, or an activity that day whose title contains the place's name. Never "any ticket that day".
- A booking can only be planned on a date it covers. A stay sits in every day it covers (check-in, staying, check-out); an overnight flight sits in both days.
- An unknown time is shown as a date alone, never as midnight.

## What it doesn't do

- Fetch bookings from anywhere, or connect to airline or hotel accounts.
- Show a booking reference in lists (they're masked, such as `•••902`), or put one in a model prompt or a log.

## Failure behaviour

- Without the encryption key configured, the vault still saves everything except the reference, and says so. It never stores a reference in the clear.
- A pasted confirmation that can't be read leaves the form for the traveller to fill. Nothing is saved until they press Save.

## Safety

- References are encrypted at rest (AES-256-GCM, a random nonce per record), decrypted only to show the traveller their own booking.
- A pasted confirmation is first stripped of references, emails, phone numbers and long card or ticket numbers. It's then read by a model call with **no tools, no trip state and no history**, so a malicious paste has nothing to steer. The result is checked against a schema and only fills a form the traveller reviews.

More in [privacy](../40-non-functional/privacy.md) and [security](../40-non-functional/security.md).

## Code and tests

- Gap detection (pure, tested): `bento/src/lib/vault/gaps.ts`; the shared ticket rule: `vault/match.ts`.
- Encryption: `vault/crypto.ts`; redaction before parsing: `vault/redact.ts`; the reader: `vault/parse.ts`.
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "The vault (P8)".

Source: spec §11; `bento/README.md` "The vault"; `docs/PROGRESS.md` "What P8 actually holds".
