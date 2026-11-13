---
type: decision
status: accepted
date: 2026-10
---

# The link is the only key

## Context

Travellers plan trips for groups: a partner, family, friends. Companions need to see the plan, often on their phones and often without wanting another account. The plan includes when and where the group will be, and the names of bookings, so whoever holds it learns something private.

## Decision

A shared trip is opened by **a link alone**:
- The link holds a random token of 32 hexadecimal characters, made by the database, and nothing else identifies the trip.
- Anyone with the link can read the plan, without an account, until the traveller stops it, replaces it, or it expires.
- Because the address is the key, it's treated like a password:
  - no analytics on the shared page;
  - no referrer sent;
  - the token replaced in anything sent to analytics.
- The page shows only what the plan sheet needs: never booking references, notes, providers, costs or anything about the owner except their pace.

## Alternatives considered

- **Companion accounts with invitations:** more control, but every companion would have to sign up, and most groups wouldn't. It may come later as an addition, not a replacement.
- **A password on the link:** another thing to pass around, and it adds little when the link and password travel together in the same message.
- **Editable shared plans:** out of scope. Changes go through the traveller and Bento Man, so the plan's rules still hold.

## Consequences

- Companions can open the link in a browser without creating an account.
- A forwarded link gives access to whoever receives it. The answer is **Make a new link**, which kills the old address at once, and expiry choices that limit how long a leaked link works.
- Expired and unknown links look the same, so a guessed address reveals nothing.
- Every new field on the shared page has to be justified by the sheet, because it becomes visible to anyone with the link.

Feature: [Trip sharing](../10-product/trip-sharing.md).
