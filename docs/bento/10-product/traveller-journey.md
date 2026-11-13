---
type: overview
status: accepted
last_reviewed: 2026-11-13
---

# The traveller's journey

A first-timer arrives with questions in a certain order. Each step is a screen, a piece of stored state, and a point where the plan can be corrected.

| # | Step | The traveller | Bento | Status |
|---|---|---|---|---|
| 1 | **Account** | Signs up with email or Google | Creates the account. Nothing else is asked yet. Sign-up exists so bookings can be held safely later, so it's real sign-in with each traveller's data isolated from the start | Shipped ([accounts and admins](accounts-and-admins.md)) |
| 2 | **Shape of the trip** | Dates, nights, budget, pace, interests, group, mobility | At most seven skippable questions. The answers become what the planner scores against, stored where the traveller can read and correct them | Shipped |
| 3 | **Route: cities and nights** | "Is five cities in nine days mad?" | Proposes cities with nights and a reason for each. An over-packed route is refused out loud, with the arithmetic. Says how well it knows each city | Shipped ([proposals and diffs](proposals-and-diffs.md), [coverage](coverage.md)) |
| 4 | **Days** | Drags, deletes, pins. Says "too many temples" | Builds ordered days; a fourth temple loses to something else without being told. Re-plans around pins | Shipped ([day view](day-view.md)) |
| 5 | **Logistics verdicts** | "Do I buy a JR Pass? How much cash?" | Answers against their own legs, with the arithmetic | **Not built yet** ([open questions](../00-start/open-questions.md)) |
| 6 | **Bookings and gaps** | Adds confirmations as they book. Nothing is fetched from airline or hotel sites | Matches each booking to a night or leg and names what's missing | Shipped ([booking vault](booking-vault.md)) |
| 7 | **On the ground** | At a ticket gate with one bar of signal, needs today's plan and a booking | A printable plan and a share link | Partly: printing and [sharing](trip-sharing.md) are shipped; an offline "today" view isn't ([open questions](../00-start/open-questions.md)) |

After the trip, Bento asks how the plan held up ([trip review](trip-review.md)).

Source: the original spec, §03.
