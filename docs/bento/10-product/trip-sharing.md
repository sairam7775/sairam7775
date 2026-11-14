---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/lib/trips/share-expiry.ts
  - bento/src/lib/trips/shared-plan.ts
  - bento/src/app/shared/
  - bento/src/app/trips/[id]/actions.ts
  - bento/src/components/plan/
  - bento/src/lib/analytics/url.ts
  - bento/supabase/migrations/0020_trip_sharing.sql
  - bento/supabase/migrations/0024_share_expiry.sql
  - bento/supabase/migrations/0030_renew_trip_share.sql
last_reviewed: 2026-11-14
---

# Trip sharing

## Summary

A traveller can give the people they're travelling with a **link to their trip plan**. Companions open it without an account and always see the latest version: the route, each day's plan, and the names and times of the bookings. They can't change anything, and they never see booking reference numbers. The traveller decides how long the link works, can switch it off, or can replace it with a new one.

## User journey

1. On the trip page, the traveller opens **Share plan** and reads who will see what.
2. They choose how long the link works:
   - **Until I turn it off** (the default);
   - **For 7 days**;
   - **For 30 days**;
   - **Until the trip ends**, offered only while the trip has an end date and hasn't ended yet.
3. They press **Share with companions**, then **Copy** or **Send…** the link to their companions.
4. **See what they see** opens the shared page as the companions will see it, with a note saying so.
5. A companion opens the link. They see the plan sheet with "This page always shows the latest version", and no sign-in is needed.
6. Later, the traveller can:
   - **make a new link** (after a confirmation): the old link stops working for everyone who has it;
   - **stop sharing** (after a confirmation): the link stops working.
7. **The downloadable plan** (Print / save as PDF):
   - while the link works, it prints the companions' link;
   - otherwise it prints the trip page's address, which opens only for the traveller;
   - when the trip has never been shared, the screen above the sheet offers to share it; this part isn't printed.

   Companions can print or save the shared plan as a PDF too.

## Acceptance criteria

- Opening a working link shows the route, each day's stops (only the facts the sheet shows) and booking names and times, without an account.
- The shared page never shows a booking reference, note, provider or cost, and nothing about the owner except their pace.
- **"For 7 days" and "For 30 days"** stop working at a fixed moment, worked out on the server from the time the link was made.
- **"Until the trip ends"** works through the whole last day of the trip (UTC), and follows the trip's dates if they change later.
- Bento's share actions work out every expiry from the traveller's choice, the trip's stored end date and the server's clock. A time sent by the browser is ignored. (The database itself would let a trip's owner change their own link's expiry directly; see Access below.)
- "Until the trip ends" is refused for a trip that has ended or has no end date, before the current link is touched.
- **Make a new link** deletes the old link and creates one with a new address in one database step (`renew_trip_share`), so the old address stops working at once, and if anything fails the old link keeps working. Two renews at once queue behind each other and leave one link.
- Pressing **Share** a second time on an already shared trip keeps the existing link.
- The trip page, the shared page and the download agree on whether a link still works: they use one rule (`shareIsActive`, the same as the database's `shared_trip()`).
- The link's address is the key:
  - the shared page starts no analytics, and the consent banner doesn't ask there;
  - it sends no referrer and asks search engines not to index it;
  - in anything sent to analytics, a share token in an address is replaced (`pathOnly`).
- Copying, sending and printing the link pass the full address on purpose: that's how companions get it.

### Access (who can do what)

| Who | Can |
|---|---|
| The trip's owner, signed in | See, create and delete their own trip's share row, and change only its expiry columns. Row-level security limits every share row to the trip's owner |
| Another signed-in user | Nothing on someone else's share row |
| Anyone, signed in or not | Only read a plan through `shared_trip(token)`, which runs with the database owner's rights and returns only the sheet's fields. They can't read the share table itself |

## What it doesn't do

- Companions can't edit the plan, add bookings or talk to Bento Man.
- There are no per-person links or access lists: anyone with the link can read the plan.
- Booking reference numbers are never shared. Companions are told to ask whoever shared the plan.
- It doesn't notify anyone. The traveller sends the link themselves.

## Failure behaviour

- **An expired, stopped or unknown link** shows the same page, "This link doesn't open a trip any more", and suggests asking for the latest link. It doesn't say which of these happened, so a guessed address reveals nothing.
- **On the traveller's own trip page,** an expired link shows "This link has expired."
- **A malformed address** (not 32 hexadecimal characters) is treated as an unknown link, without asking the database.
- **If the shared plan can't be loaded,** because the database call fails or returns data in an unexpected shape, Bento's general error page appears: "That didn't load." with "It's on our side, not yours", and a way to try again. An unexpected shape is Bento's fault, so it's never shown as a switched-off link, and never as part of a plan.
- **If changing the sharing fails:** the traveller returns to the trip page with "Couldn't change sharing for this trip. Try again in a moment."
  - A refused choice (such as "until the trip ends" for a trip that's over) is caught **before** the old link is touched.
  - **If making a new link fails,** the traveller sees "Couldn't make a new link. Try again in a moment." When the database step failed, nothing changed: the delete and the insert are one transaction, so the old link still works, and the trip page shows the link as it stands. A trip that isn't the traveller's is refused with nothing changed.

## Code and tests

- Expiry rules: [share-expiry.ts](../../../bento/src/lib/trips/share-expiry.ts), tested in [share-expiry.test.ts](../../../bento/src/lib/trips/__tests__/share-expiry.test.ts).
- Turning sharing on, renewing and stopping: `shareTrip`, `renewShareLink` and `stopSharing` in [actions.ts](../../../bento/src/app/trips/[id]/actions.ts).
  - [share-actions.test.ts](../../../bento/src/app/trips/[id]/share-actions.test.ts) tests `shareTrip` (the stored expiry and the refused choices) and `renewShareLink` (one `renew_trip_share` call with the server's expiry, and a failure or refusal shown as a failure).
  - [renew-trip-share.test.ts](../../../bento/src/lib/db/renew-trip-share.test.ts) reads 0030 and checks it runs with the caller's rights, a safe search path and signed-in-only grants, and that no migration lets travellers write a token.
  - **Not covered by automated tests yet:** stopping, a second tap on Share, and the function on a real database (it was run once on a local copy of the migrations, not in CI). These are checked by hand against the acceptance criteria above.
- The shared page: [bento/src/app/shared/[token]/page.tsx](../../../bento/src/app/shared/[token]/page.tsx), and the "link doesn't open" page next to it.
- The sheet the shared page and the download share: [shared-plan.ts](../../../bento/src/lib/trips/shared-plan.ts), tested in [shared-plan.test.ts](../../../bento/src/lib/trips/__tests__/shared-plan.test.ts).
- Database:
  - [0020_trip_sharing.sql](../../../bento/supabase/migrations/0020_trip_sharing.sql): the `trip_shares` table, the token and `shared_trip()`;
  - [0024_share_expiry.sql](../../../bento/supabase/migrations/0024_share_expiry.sql): expiry;
  - [0030_renew_trip_share.sql](../../../bento/supabase/migrations/0030_renew_trip_share.sql): `renew_trip_share()`, a new link in one transaction.
- Address scrubbing for analytics: [url.ts](../../../bento/src/lib/analytics/url.ts).
- The words on screen are in `copy.share` in [en.ts](../../../bento/src/copy/en.ts).
- The rules agents must keep are in [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Sharing".

## Related decisions

- [The link is the only key](../70-decisions/2026-10-share-links-by-token.md)
