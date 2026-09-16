# Bento — where the project stands

Last updated 16 September 2026, after P7.

The design document is [`spec.html`](./spec.html); it is the source of truth
for decisions, and section numbers here refer to it. Working notes for
anyone writing code live in [`../bento/CLAUDE.md`](../bento/CLAUDE.md).

Branch: `claude/japan-travel-guide-bot-s5crhl`. Supabase project
`xjlrnhwmvlcidtnobrsg` (ap-south-1). Migrations `0001`–`0010` applied.

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
| P8 | Booking vault and gap detection | Next |

### Commits

```
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

What it will not do, by design: plan a city it has not verified enough
records for, put two conflicting places in one day, fill a Monday with
something closed on Mondays, rank a place the traveller excluded, invent a
travel time, or claim a fare it did not compute.

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
- **Trip dates are baked into a route proposal.** Changing the dates now
  rejects any pending proposal rather than recomputing it. The cleaner fix
  is to compute dates at apply time; it is a schema change to `RouteCity`.
- **`state()` and `cities()` re-run per tool call.** Memoising per request
  would cut a handful of queries per turn. Not hot yet.
- **The rate limiter is in-memory**, so it holds per instance. It must move
  to Postgres or Redis before sign-ups open.

---

## Before this works end to end

Three things need you, and nothing in the product can do them.

1. **Set `ANTHROPIC_API_KEY`** in `bento/.env.local`. Without it the chat
   says so plainly and everything else still works. `BENTO_MAN_MODEL`
   defaults to `claude-opus-5` and `BENTO_MAN_EFFORT` to `medium`.

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
| `npm test` (83 tests) | Green |
| `npm run build` | Compiles |
| Supabase advisors | Two intentional findings, both documented |
| Bento Man eval (31 scenarios) | **Never run** — needs an API key |
| The chat against a real model | **Never run** — same reason |
| The day view in a browser | **Never run** — no dev server in this environment |

Everything marked "never run" is not a claim of brokenness; it is an honest
statement that the code has been typechecked, linted, unit-tested and built,
but nobody has watched it work.

---

## Next: P8, the vault and the gaps

The remaining phase, from §13:

- Uploaded confirmations, parsed in a separate model call with no tools
  attached, so a malicious pasted blob has nothing to steer.
- References encrypted at rest, never logged, never placed in a prompt.
- Gap detection: "you have nowhere to sleep on 14 April" shown where it
  belongs in the plan, distinguishing *never needed a booking* from *not
  booked yet*.
- Storage buckets scoped per user, which migration `0004` already set up.

After that the open questions in §17 are scoring weights (tune once the
eval exists, which it now does) and monetisation (deferred until sign-ups
open).
