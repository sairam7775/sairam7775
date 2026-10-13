# Bento — where the project stands

Last updated 16 September 2026, after P8. Every phase in §13 has shipped.

The design document is [`spec.html`](./spec.html); it is the source of truth
for decisions, and section numbers here refer to it. Working notes for
anyone writing code live in [`../bento/CLAUDE.md`](../bento/CLAUDE.md).

Branch: `claude/japan-travel-guide-bot-s5crhl`. Supabase project
`xjlrnhwmvlcidtnobrsg` (ap-south-1). Migrations `0001`–`0012` applied.
Not deployed anywhere yet; the Vercel config and the steps are in the
app's README under Deploying.

---

## The shape of the thing

One chat box, three products stacked (§01):

| Layer | What it is | Who owns it |
|---|---|---|
| Bento Man | The guide the traveller talks to | Rented — Claude Opus 5 |
| The recommender and scheduler | Which places, in what order, at what time | Ours, pure TypeScript |
| The data | ~2,000 places with honest judgement fields | Ours, human-verified |

The rule that holds it together: **the model may never state a fact it was
not handed**. Durations, fares, opening hours and travel times come from
the engine and are passed into the prompt as data. The model chooses a
tool and writes prose; it never writes the itinerary.

---

## Phases

| Phase | What shipped | State |
|---|---|---|
| P1 | Auth, schema, row-level security, coverage tiers, spend controls | Done |
| P2 | All Japan at stub tier (9 regions, 47 prefectures, 99 cities) plus the `/admin` curation UI | Done |
| P3 | Transit graph: Dijkstra over (station, line), fare bands, GTFS importer, hand-seeded Kansai–Sanyo corridor | Done |
| P4 | The engine: scoring with a reason clause per term, and the seven-step day scheduler | Done |
| P5 | 134 drafted place records across the corridor, the export pipeline, and the `/admin/review` sign-off queue | Done — **awaiting your verification** |
| P6 | Bento Man: nine tools over the engine, proposals the traveller accepts or rejects, the eval set | Done — **eval unrun** |
| P7 | The day view: a day is a bento box, drag/pin/remove, the bento palette | Done |
| P8 | The vault: bookings, encrypted references, upload parsing, and the gap detector | Done |

### Commits

```
28fd8f2  Fix the P6 review findings, and write the progress report
e985038  P7: the itinerary UI — a day is a bento box
c8d8497  P6: Bento Man — the conversation over the engine
f14dd54  P5: deep data — 134 drafted places for the Kansai–Sanyo corridor
1ae7bad  P4: the engine — recommender and day scheduler
7811e87  P3: transit graph — router, fares, GTFS importer, corridor seed
```

---

## What a traveller can do today

Sign in, start a trip, and talk to Bento Man at `/trips/<id>`.

1. **Onboarding.** Up to seven skippable questions. Answers are stored where
   the traveller can read and correct them, never inferred silently.
2. **Route.** Bento Man calls `assess_route` before endorsing anything. Five
   cities in nine nights comes back over-packed with the arithmetic: nights
   per city, city changes at two hours each, hours on trains, the share of
   waking time spent moving. A route becomes a proposal with Accept and
   Reject, not an applied change.
3. **Days.** `plan_days` runs the P4 scheduler. Each day arrives as a diff:
   every stop flagged kept, new, moved or out, with what was left out and
   the term that removed it.
4. **Changes.** "Too many temples on the 23rd" becomes a re-plan that avoids
   the category. "Be at Sanjusangen-do at 10" becomes a pin. Neither
   regenerates the rest of the trip.
5. **The box.** The open day is a lacquer frame of compartments sized to the
   time each stop takes, the train written on the frame between them, lunch
   in the first gap, and a dashed line where the day's budget runs out.
   Drag, pin and remove apply at once; the engine re-times the day.
6. **The vault.** `/trips/<id>/vault` holds what they have booked and names
   what is missing. A ribbon shows one bar per night, solid where covered
   and hatched where not. Under it, sentences rather than error codes:
   "You have nowhere to sleep on the night of 26 November. Your Kyoto
   hotel runs through the 25th and the next booking starts on the 27th."
   References are encrypted at rest and masked in lists. A pasted
   confirmation is read by Haiku with no tools attached, and fills the
   form in for review.

What it will not do, by design: plan a city it has not verified enough
records for, put two conflicting places in one day, fill a Monday with
something closed on Mondays, rank a place the traveller excluded, invent a
travel time, claim a fare it did not compute, fetch anything from an
airline or a hotel, or store a booking reference in the clear.

---

## Code review, and what came of it

A reviewer agent audited P6 against the spec and the invariants. It
confirmed the architecture holds the line — every number the model can say
is produced by the engine, the model's only write path is a proposal, and
no unverified record or booking reference can reach a prompt — and found
two blockers and nine smaller defects. Verdict was "fix first".

### Fixed

| Was | Now |
|---|---|
| Accepting a proposal left the buttons live; a second click errored | The chat re-syncs from the server after a resolve, the buttons disable while the action runs, and the accept is a compare-and-swap so two submits cannot both apply |
| A route with a repeated city wiped `trip_cities` (delete then failed insert) | Duplicates are refused at the schema with an explanation the model can relay, and the route swap is one transaction (`replace_trip_route`) |
| A turn that failed after a model call recorded no usage | Partial usage rides on the error and is recorded in a `finally`, so the spend cap counts what was actually spent |
| One turn priced at the last model that served it | Usage is accumulated per model, so a refusal fallback bills both correctly |
| `route_between` added an invented 10-minute walk | A walk is counted only when it is on record; otherwise the journey says so |
| A place with no opening hours read as "always open" | Reads as "no fixed hours on record" |
| A route longer than the trip was proposed anyway | Refused, with the mismatch named |
| Days from a dropped city out-voted the new route | Cleared when the route changes |
| A client disconnect mid-turn threw inside the stream | Writes are guarded and the usage record still lands |
| The eval counted a clean tool refusal as a failure | Only a successful call counts against `notTools` |
| The voice lint flagged ✓ and ✗ as emoji | Pictographs only |
| A truncated turn could drop half a tool call | `max_tokens` raised and handled explicitly |

### Outstanding, deliberately

- **Per-day item writes are atomic; the multi-day apply is not.** A proposal
  covering ten days writes each day in its own transaction. A failure
  mid-way leaves earlier days applied. The proposal is handed back as
  pending so the traveller can retry, which is enough for now.
- ~~**`state()` and `cities()` re-run per tool call.**~~ Fixed by cleanup #25:
  each request's Supabase store shares these reads and refreshes state after writes.

Since fixed (see "Pre-launch engineering" below): route dates are now laid
out at apply time, and the rate limiter is in Postgres.

---

## Before this works end to end

Three things need you, and nothing in the product can do them.

1. **Set the two keys** in `bento/.env.local`. Without either, the feature
   it powers says so plainly and everything else still works.

   ```bash
   ANTHROPIC_API_KEY=...                    # Bento Man, and reading pastes
   BENTO_BOOKING_REF_KEY=$(openssl rand -base64 32)   # booking references
   ```

   `BENTO_MAN_MODEL` defaults to `claude-opus-5` and `BENTO_MAN_EFFORT` to
   `medium`. Keep the booking key safe: change it and every stored
   reference becomes unreadable, which the vault will tell you rather than
   show you rubbish.

2. **Verify the drafts.** All 134 records are drafts, and the planner
   refuses to build a day from a draft — so until you sign records off,
   Bento Man will correctly tell you it does not know Kyoto well enough.
   Work through `/admin/review`: one record at a time, every field on
   screen, one button to verify and one to skip. Deep tier needs 25
   verified places; the batch is sized so all four cities can clear it.

   ```
   npx tsx scripts/grant-admin.ts sai.ram7775@gmail.com
   ```

3. **Run the eval.** 31 scenarios against the real model, graded
   mechanically. It has never been run — this sandbox has no API key and no
   network to Anthropic. Expect a few cents per run.

   ```
   npx tsx scripts/eval-bento-man.ts                           # Opus 5
   npx tsx scripts/eval-bento-man.ts --model claude-sonnet-5   # the D8 test
   ```

   D8 said Opus 5 first and Sonnet 5 once the eval holds. That decision is
   waiting on this number.

---

## Verification status

| Check | State |
|---|---|
| `npm run typecheck` | Clean |
| `npx eslint .` | Clean |
| `npm test` (97 tests) | Green |
| `npm run build` | Compiles |
| Supabase advisors | Two intentional findings, both documented |
| Bento Man eval (31 scenarios) | **Never run** — needs an API key |
| The chat against a real model | **Never run** — same reason |
| The production server booting, and the security headers | Verified — the home page served 200 with all six headers |
| The day view and the vault in a browser | **Never run** — needs a signed-in account and data |
| Reading a pasted confirmation | **Never run** — needs an API key |

Everything marked "never run" is not a claim of brokenness; it is an honest
statement that the code has been typechecked, linted, unit-tested and built,
but nobody has watched it work.

---

## What P8 actually holds

The gap detector is pure logic over the traveller's own data, which is
what the decision not to fetch from airlines or hotels bought. Three
severities:

| Severity | Means | Example |
|---|---|---|
| Blocking | The trip does not work without this | A night with no bed; a place on the plan that needs a ticket you do not have |
| Closing | A booking window is running out | A timed ticket whose lead time is nearly up |
| Worth knowing | Probably fine, but you should know | An unbooked city change where an IC card is enough |

The distinction that makes the list usable is *never needed a booking*
against *not booked yet*. A temple is not a gap. Consecutive uncovered
nights are one sentence, not five. A gap you have seen and decided to live
with is dismissed and kept, so it can be brought back.

On holding references: AES-256-GCM, a random nonce per record, a version
prefix so a future algorithm change can still read old rows, decrypted
only to render for its owner, masked to the last three characters in any
list. Without `BENTO_BOOKING_REF_KEY` the vault saves everything else and
refuses the reference rather than storing it in the clear.

On reading a paste: Haiku 4.5, no tools, no trip state, no history. That
is the entire mitigation for prompt injection through an upload, and it
works because there is nothing for a malicious blob to reach.

## Open, and next

From §17, now that every phase has shipped:

- **Scoring weights.** Fig. 1's weights are seed values and the first
  thing to tune. The eval set exists now, so this is measurable rather
  than a matter of taste.
- **The Sonnet 5 test.** D8 deferred it until the eval held. Run the eval
  on both and compare.
- **Monetisation.** Deferred with the commercial risks until sign-ups open.

Engineering work that is not a phase but will be needed before anyone else
uses this:

- A multi-day proposal writes each day in its own transaction. A failure
  mid-way leaves earlier days applied and hands the proposal back.

## Pre-launch engineering (12 October 2026)

- **Rate limiter in Postgres.** `0012_rate_limit.sql`: a token bucket per
  (user, kind) taken under a row lock by `take_rate_token`, so the limit
  holds across serverless instances. The limits (chat 20/min, parse
  10/min) live in the SQL function, because a caller-supplied limit would
  let anyone refill their own bucket over RPC. It keys on `auth.uid()`
  and fails closed. Exercised against the live project in a rolled-back
  transaction: 20 allowed, the 21st refused with a 3-second retry, kinds
  separate, `anon` cannot execute, no user is refused. Applied to the
  project on 12 October 2026.
- **Currency in the vault.** `vaultTotal` (`src/lib/vault/money.ts`)
  converts on read against `fx_rates` and shows a converted sum as `~¥`
  with the date of the oldest rate used. A currency with no rate is named
  beside the total, never guessed. `scripts/import-fx-rates.ts` fills the
  table from ECB reference rates (dry run by default; `--apply` needs the
  service-role key). Until it is run, only JPY converts.
- **Route dates at apply time.** `applyProposal` lays the route on the
  trip's current dates instead of the dates stored on the proposal, and
  refuses one that no longer fits. A date change now closes only pending
  day plans and routes that no longer fit; a route that still fits stays
  open.

## UI pass and full-codebase review (12 October 2026)

- **UI** (`cda5908`): one-row header, edit-trip panel, confirms, chat panel
  that fits the window, Zen Maru / Zen Kaku fonts, loaders and skeletons,
  seasonal animated backdrop, redesigned landing and auth pages,
  `bento/DESIGN.md`. Fixed the app always rendering dark (nested `@theme`).
- **Security** (`51150b7`): `0013_lock_public_views` (applied) — `places_public`
  was writable with the anon key; `safeNext` for post-sign-in redirects;
  failed booking reads now count against the spend cap; excludes normalised.
- **Wrong-answer fixes** (uncommitted at time of writing): bed gaps split per
  city; shared ticket matcher (`vault/match.ts`) for gaps and planner;
  required tickets always blocking; plan_days honours a same-turn route and
  refuses out-of-trip dates; validate rounds never return a dropped stop;
  0-night cities costed as day trip or stop-on-the-way; unpriced fares never
  "free"; chat history normalised; booking times stored as wall time; date
  changes refused when planned days would fall outside.

### Still open from the review

- ~~Spend cap is per user only, and concurrent turns can overshoot it (#4, #5)~~ Done on branch `claude/spend-cap`: `0014_spend_reservations.sql` (NOT yet applied to the live database), `reserveSpend`/`settle` in `lib/guards/spend.ts`, `BENTO_GLOBAL_MONTHLY_SPEND_CAP_USD`.
- Codex review of PR #3 (10 findings) fixed on `claude/spend-cap`: booking-date regex, billed usage kept when the reply can't be saved, per-call spend holds that must fit the caps, city-aware beds, accepted day start kept on replan, day-box order follows the server, atomic `apply_proposal` / `update_trip_dates` (`0015_atomic_trip_edits.sql`, NOT yet applied), shifted stops revalidated, reordered routes drop mismatched days. **Migrations 0014 and 0015 must both be applied before merge.** SQL itself is untested against a live database.
  — needs a project-wide cap and a reservation before the model call.
- `applyProposal` and `setTripDates` are multi-statement, not atomic
  (#7, #8) — one SQL function each.
- Decision needed: should `set_trip_dates` from the chat be a proposal the
  traveller accepts, like every other plan change (#6)?
- ~~Cleanup (#23–#25).~~ Done on `codex/cleanup-2`: trip-page engine calls
  moved into a tested lib helper; `deleteTrip` and `savePlace` validate with
  Zod; shared clock formatter, day statistics and request-local store reads.
