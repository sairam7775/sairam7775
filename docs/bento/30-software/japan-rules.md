---
type: design
status: accepted
code:
  - bento/src/lib/engine/filter.ts
  - bento/src/lib/vault/gaps.ts
last_reviewed: 2026-11-13
---

# Japan rules the engine must encode

These are the things first-timers reliably get wrong. The spec's intent: each one is a rule in the scheduler or a check in the gap detector, not advice buried in prose nobody reads.

**Status** says what the code does today. "Not built" items are also listed in [open questions](../00-start/open-questions.md).

| Rule | Why it bites | Where it should live | Status |
|---|---|---|---|
| Many museums close on Mondays (or Tuesday after a Monday holiday) | A Monday built without this is locked doors | Hard filter, scheduler step 2 | **Built:** places carry closed weekdays; the engine's Monday test stays green |
| Some tickets sell out weeks ahead (Ghibli Museum, teamLab, Shibuya Sky sunset slots, sumo, kaiseki counters) | The traveller finds out too late | Booking lead times per place, and a countdown | **Built in part:** places can require a booking, the planner won't plan them without one, and the gap detector marks closing booking windows ([booking vault](../10-product/booking-vault.md)) |
| A JR Pass rarely pays off | After the October 2023 price rise, the 7-day pass rarely beats single tickets, and it excludes the Nozomi | A break-even check on the traveller's own legs | Not built |
| Oversized luggage needs a reserved seat | Bags over 160 cm (total) need a reserved seat with luggage space on the Tokaido, Sanyo and Kyushu Shinkansen | Gap detector, from the declared case size | Not built (city changes are costed at two hours, partly for luggage) |
| Luggage forwarding exists | Hotel-to-hotel forwarding is cheap and usually next-day; most visitors don't know | Offered on every city change | Not built |
| IC card, not paper tickets | Suica and Pasmo work almost everywhere | An arrival-day checklist | Not built as a checklist (mentioned in train legs) |
| Cash still matters | Small restaurants, shrine offerings, rural buses and stalls are cash-only | A cash line in the budget | Not built |
| Peak weeks are a different country | Golden Week, Obon and New Year: full hotels, booked trains, higher prices | A date check before planning | Not built |
| Kyoto buses are a trap | Tourist buses are slow and full; subway and walking usually win | A per-city transit preference | Not built |

Figures in "why it bites" are from the original spec (2026) and aren't maintained here; any figure shown to a traveller must come from the engine, never from this note.

Source: spec §12.
