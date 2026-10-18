# Bento — working notes

A Japan trip planner. The design document is `../docs/spec.html`; it is the
source of truth for decisions, and section numbers below refer to it.

## The one idea that shapes everything

**We own the reasoning and rent the language** (§04). The recommender and day
scheduler are pure TypeScript. The language model handles intent parsing and
prose only.

The test for where something belongs is whether being wrong is visible. A badly
phrased sentence is obvious and harmless. A silently dropped constraint looks
like a working plan and strands someone. Everything in the second category
belongs in code.

Practically:

- Durations, fares, opening hours, travel times → the engine, always.
- The model may never state a fact it was not handed.
- The model proposes diffs; it never writes the itinerary directly.
- Opus 5 first, Sonnet 5 only once the eval holds (D8).

## Invariants

- **Nothing unverified reaches a traveller.** Judgement fields on `places` are
  `NULL` until `verification_status = 'verified'`, enforced by the
  `places_public` view. Never query `places` directly from user-facing code.
- **Every new view gets an explicit `revoke insert, update, delete … from
  anon, authenticated`.** Supabase's default privileges grant writes on
  every new relation, a simple single-table view is auto-updatable, and a
  definer view bypasses the base table's RLS — `places_public` was
  writable by anyone with the anon key until `0013_lock_public_views`.
- **Redirects after sign-in go through `safeNext`** (`lib/safe-next.ts`).
  "Starts with /" is not enough: `//evil` leaves the site.
- **Every way to create an account passes the age screen** (`lib/age-gate.ts`,
  COPPA): email sign-up and Google sign-in both check the cookie, and the
  birth date is never stored. A new sign-up route needs the same check.
- **Analytics only with consent, and never content.** PostHog (EU) starts
  only when the `bento_analytics` cookie is "yes" (banner or Settings);
  "no" clears its storage. Everything goes through `lib/analytics/client.ts`:
  send names, counts, durations, ids, booleans and copy keys (`reasonOf`),
  never chat text, booking titles or references, emails, names or birth
  dates. Autocapture keeps no element text; replays mask all text and
  inputs. Without `NEXT_PUBLIC_POSTHOG_KEY` nothing loads and nobody is
  asked. If you collect something new, update `copy.privacy` too.
- **Deleting an account removes everything of theirs** (Settings →
  `deleteAccount` → `lib/account/delete.ts`): every user table cascades
  from `auth.users` or from `trips`, so a new user table needs
  `on delete cascade` too. `api_usage` is the exception: it is unlinked
  (user_id = null) first, because the global spending cap sums it. PostHog
  data is deleted too when `POSTHOG_PERSONAL_API_KEY` and
  `POSTHOG_PROJECT_ID` are set; the privacy page says which. Admins can't
  delete themselves from the UI.
- **RLS on every user table.** Never reach for the service-role client to work
  around a policy — if a query needs it, the policy is wrong.
- **Costs are stored in JPY.** Conversion happens on read, so a stale rate can
  never be baked into stored data.
- **Budget lives on `trip_cities`, not `trips`** — a ryokan night in Hakone
  must not make the Tokyo days score as overspending.
- **`excludes` is a hard filter**, applied before scoring. "No beaches" means
  never, not rarely.
- **A booking reference is encrypted at rest, never logged, and never
  placed in a model prompt.** A PNR plus a surname can cancel a flight.
- **Reserve spend before every model call** (`reserveSpend`, 0014), sized to
  the most one call can cost (`callBoundUsd`), and settle it with what the
  call really cost. A chat turn takes a hold per model call and ends
  politely when none is left. It throws rather than returning a flag so a forgotten check
  cannot spend money. The hold is taken under a database lock, so parallel
  requests see each other; there is a per-user cap and a project-wide cap.

## Engine (P4)

- Pure functions in `src/lib/engine/`. No framework, no network, no model.
  Called from route handlers and server actions, never from components —
  this is also what keeps the React Native path open (§14).
- `scorePlace` (Fig. 1) returns a breakdown; every term that moved the
  score owns a clause, and `buildReason` assembles the shown reason from
  those clauses. A reason is never written after the fact.
- `planDay` (Fig. 2): budget → filter → anchor → grow → order → time →
  validate. Rejects are returned in `considered` with the term that
  removed them. Per-slot `alternatives` are kept so a swap has options.
- Hard rules live in `filter.ts` and never become penalties: stub tier,
  unverified, excluded, a hard mobility `skip_if`, closed today, booking
  required and not booked.
- The anchor holds position 0 through growth and ordering. Timed pins are
  slotted where the clock reaches them. Ordering charges 30 min for a busy
  place that would miss its quiet window.
- Scores shown on items are recomputed against the final order, so "your
  third temple today" is the third one shown.
- Known gaps: windows are soft except for the anchor; a place with no
  station costs a flat 45 min and a warning; season tags are optional and
  neutral when absent.
- Tests: `src/lib/engine/__tests__`, fixtures in `__fixtures__/kyoto.ts`.
  The traps must stay green: Arashiyama and Fushimi Inari never share a
  day; a Monday never fills with something closed on Mondays; "no hiking"
  means never.

## Curation data (P5)

- `src/lib/places/seed/<city>.ts` is the source of truth for drafted
  places; `supabase/seed_places_draft.sql` is generated by
  `scripts/export-places-seed.ts`. Never edit the SQL by hand.
- Every seed record lands with `verification_status = 'draft'` and the
  upsert is guarded by `where places.verification_status = 'draft'`, so a
  re-export can never overwrite a record a human has verified.
- A `station` in a seed record must be a station id in the transit seed
  (it is a foreign key). A place only a bus or a walk serves gets
  `station: null` and pays the engine's 45-minute fallback; add the stop
  to `kansai-sanyo.ts` instead when the route matters.
- `conflicts` and `pairs` must point at existing ids in the same batch;
  the exporter fails otherwise.
- Hours are same-day: `closes` must be after `opens`. An overnight venue
  gets `closes: "23:59"` and the real time in the tip.
- Categories are free text but keep to the list in `seed/types.ts`;
  `closedWeekdays` uses 0 = Sunday.
- `/admin/review` is the sign-off queue. `verifyPlace` redirects to the
  `back` field so the next draft loads without a round trip to the list;
  `back` must start with `/admin/`.
- `/admin/review/bulk` verifies many drafts at once (`verifyPlaces`). It uses
  the same rule as the single Verify (`lib/places/verify.ts`
  `missingForVerify`: a typical duration, a tag, a source), re-checked on the
  server for every id, and only flips rows still in draft. Verifying never
  changes a city's coverage tier; that stays a separate step on the city page.

## Bento Man (P6)

- `src/lib/bento-man/`. `chat.ts` runs one turn: history + a
  `<trip_state>` block + the message → the model → tools → prose. The
  system prompt (`prompt.ts`) and tool list (`tools.ts`) are the cached
  prefix and must stay byte-stable: no dates, names or state in them.
- `provider.ts` is the model-call boundary. `BENTO_MAN_PROVIDER` selects
  `anthropic` (default) or `gemini`; `BENTO_MAN_MODEL` overrides the
  provider's default model. The chat loop owns tool execution and spend holds.
- The Anthropic provider calls `claude-opus-5` through the beta client with
  `fallbacks: "default"`, adaptive thinking, `output_config.effort` from
  `BENTO_MAN_EFFORT`. Streaming always; `finalMessage()` for the result.
- Gemini uses REST streaming and defaults to `gemini-3.8-flash` (`2.5-flash`
  is closed to new API keys). Its price in `cost.ts` is the paid-tier rate, so
  the cap is conservative on the free tier; the rate rises on 2027-01-01.
  500/503/504 are retried twice before anything has streamed; 429 is not
  (the free tier allows 20 requests a day per model, and a retry spends one).
  Instead, a 429 or lasting overload moves to the next model in
  `BENTO_MAN_FALLBACK_MODELS` (default 3.6 Flash, then 3.1 Flash-Lite; each
  free-tier model has its own quota). Signatures from one Gemini 3 model are
  accepted by another, checked live. The spend hold is sized to the dearest
  model in the chain. Each fallback must pass the eval too; the eval itself
  never falls back, so it always grades the model it names.
  Free-tier prompts may be used by Google to improve products: do not send
  production booking text through it. `src/lib/vault/parse.ts`, the booking
  reader, stays on Anthropic and is independent of the chat provider.
- Every new provider must pass `scripts/eval-bento-man.ts` against the real
  model before use. Set `BENTO_MAN_PROVIDER` and its API key to evaluate it;
  mocks and unit tests do not satisfy this rule.
- Every tool validates its input with Zod and returns a JSON string. A
  bad input is an `is_error` result the model can recover from, never a
  throw. Tools that change the plan write to `ctx.proposal`, nothing else.
- A `Proposal` (`diff.ts`) is validated on the way into `chat_messages`
  and again on the way out. `acceptProposal` is the only writer of
  `trip_cities`, `itinerary_days` and `itinerary_items` from the chat.
- `TripStore` has two implementations. `SupabaseStore` is the product and
  reads places through `places_public`; `MemoryStore` is the eval set and
  the tests, and treats the drafted corridor as verified. Never let the
  memory store near a request handler.
- `city_coverage` is the traveller-safe view for tiers and verified
  counts; `curation_progress` stays admin-only because it counts drafts.
- Accepting a proposal (`apply_proposal`) and changing the dates
  (`update_trip_dates`) are each ONE database function (0015): never add a
  second write after them from TypeScript. A date change that would put a
  planned stop on a day it is closed, or a ticketed stop on a day with no
  ticket, is refused (`shift.ts`). Accepting a route drops planned days the
  new calendar gives to another city (day trips included: re-propose them).
- Moving dates the trip already has is a **proposal** (`Proposal.dates`, #6),
  unless the traveller allowed changes without asking
  (`user_preferences.apply_dates_without_asking`). Filling in missing dates,
  a title or a party size applies at once. Only the traveller's own action
  sets the permission ("Don't ask" in Edit trip, or the checkbox on an
  accepted date proposal); `set_preferences` can't, so the model can't grant
  itself permission. Within a turn, tools after a date proposal plan on the
  new dates (`withProposedDates` in tools.ts). Accepting runs the date change
  and the rest of the proposal as ONE function (`apply_proposal_with_dates`,
  0016), refused if the trip moved since it was proposed.
- Guards before every model call: auth → `rateLimit` (Postgres, `take_rate_token`; limits live in the SQL) → `reserveSpend`.
  `reservation.settle()` after, with `costUsd` from `cost.ts` — keep the price
  table current or the cap lies. A call that never reached the model settles
  with `null`.
- `mock.ts` is a fake client for local work without a key
  (`BENTO_MAN_MOCK=1`, never in production). It replaces only the model —
  keyword → tool, canned prose, zero usage — so tools, engine and
  proposals still run for real. Not a substitute for the eval.
- The eval (`evals/scenarios.ts`, `scripts/eval-bento-man.ts`) is the
  regression check for prompt edits and the Sonnet 5 test. Add a scenario
  with every prompt rule you add; `voiceLint` runs on every reply.
- The model never sees tier names. The trip state and tool results say how
  well Bento knows a city in the city chips' words (`coverageWords` in
  `context.ts`, from `copy.coverage`), so what Bento Man repeats is what the
  page says; `voiceLint` fails a reply that says "tier" or "stub".
- An overpacked route is a conversation before it is a proposal:
  `propose_route` refuses it unless `traveller_insists`, and after a refusal
  it stays refused for the rest of that turn, so the traveller hears the
  arithmetic before they can overrule it. `assess_route` doesn't block (the
  turn they insist, the model assesses again). The model can't be checked
  for honesty about "insists", so the proposal card says it is overpacked
  and its button reads "Accept anyway" — the traveller is warned by code.

## Day view (P7)

- `src/app/trips/[id]/day-box.tsx` is the box; `day-actions.ts` are the
  traveller's edits. An edit is applied at once and re-timed by
  `engine/retime.ts` — never by the component, never by a model. The
  component only reorders an id list optimistically.
- `retimeDay` makes no choices: the order is the traveller's, the times
  follow. `planDay` (via `replanDay` in tools.ts) is the only thing that
  chooses, and it always returns a proposal.
- `engine/day-stats.ts` sums what is stored for the view (active time,
  over-budget index, the lunch gap). It must not invent times.
- Palette and motion live in `globals.css`: `paper`/`surface`/`sunk`/
  `lacquer`/`rice`, ink levels, `accent` (salmon), `ume`, `edamame`,
  `tamago`, `lavender-soft`; `.tile`, `.box`, `.up`, `.pop`, `.grow`,
  `.ring`, `.lift`, all off under reduced motion. Use tokens, not hex.
- Fonts are fontsource packages imported in `layout.tsx` — no build-time
  fetch. Zen Maru Gothic display, Zen Kaku Gothic New body, DM Mono data.
  The logo wordmark stays outlined Bricolage Grotesque (it is artwork).
- The seasonal scenes and particles (`components/seasonal/`) are the one
  exception to "tokens, not hex": they are illustration with their own
  palette, like the logo. Keep them behind the veil, `aria-hidden`, and
  out of anything a traveller reads.
- Which season shows: `?season=` preview, then Settings → Background (the
  `bento_season` cookie, passed from the root layout as `chosen`), then a
  trip page's `<UseSeason>`, then today's date in the browser.
- No `backdrop-filter` or `filter` on anything that animates or sits over
  animation — it re-rasterises every frame. Blur only static layers.
- `DESIGN.md` is the design system in prose and tokens: read it before UI
  work. `globals.css` wins if the two disagree — then fix `DESIGN.md`.
- The dark palette overrides variables on `:root` inside the media query.
  Never nest `@theme` in `@media`: Tailwind v4 hoists it and the dark
  values apply in light mode too.
- Settings → Theme (System / Light / Dark) is the `bento_theme` cookie
  (`lib/theme.ts`). The root layout puts `data-theme` on `<html>` and picks
  the browser-bar colour; `globals.css` has the dark values twice — under
  the media query for `:root:not([data-theme="light"])` and under
  `:root[data-theme="dark"]`. Change one, change both.

## After the trip

- From a trip's last day on (UTC date, the same as the database's
  `current_date`), a trip with a route asks "How did the plan hold up?"
  (`trip-review.tsx`, `saveTripReview`, `lib/trips/review.ts`). One answer
  per trip in `trip_reviews` (0019), changeable; RLS lets only the owner
  write it, and only once the trip has ended. The outcome and challenge keys
  are fixed by check constraints — add a key there, in `review.ts` and in
  `copy.review` together (a test compares them).
- The first answer saves the plan as it stood (`plan`): the database makes
  it (`trip_reviews_plan` trigger, 0019) and keeps it through every later
  change, whatever a client sends, because the trip may have been edited
  since. The app never sends a plan. `/admin/trip-reviews` reads answers and saved plans through
  the service role — the route and the stops of every day marked hard — so a
  failure can be traced to the plan that caused it, never the trip's
  current state. No names or emails on that page. Analytics get counts only
  (`trip_reviewed`), never the note.

## The vault (P8)

- `src/lib/vault/`. `gaps.ts` is pure and testable: trip dates, route,
  planned places and bookings in, sentences out. No network, no model.
- A gap's `key` is stable across runs, because a dismissal is stored
  against it. Changing how a key is built un-dismisses things.
- The detector must distinguish *never needed a booking* from *not booked
  yet*. `booking_req = 'none'` is never a gap. Consecutive uncovered
  nights are one gap per city, not one per night (a run crossing cities
  splits, so each names its own city).
- Severities: `blocking` (the trip does not work), `closing` (a window is
  running out), `worth_knowing` (probably fine). A missing bed is
  blocking; an unbooked corridor train is not. A required ticket with none
  held is always blocking, however close its window; `closing` is for
  recommended bookings.
- Whether a booking holds a place's ticket is `match.ts`, shared by the
  gap detector and the planner (`store.bookings()` → `bookedPlaceIds`) so
  they never disagree: linked `place_id`, or an activity that day whose
  title contains the place's name. Never "any ticket that day".
- A booking joins the plan when the traveller drags it into one of its
  days (`bookings.planned_on`, 0017), and then sits in every day it covers
  (a stay: check-in, staying, check-out; an overnight flight: both days): a
  fixed block at its booked time, never moved or planned by the engine; a
  stop overlapping its busy time is flagged. It may only be added on a date it covers (`vault/plan-day.ts` `canPlanOn`) — the box, the
  action and a check constraint all refuse any other. `planned_on` is a
  date, not a day id, because accepting a proposal rewrites days.
- A booking time can be unknown (`starts_time_known` / `ends_time_known`,
  0018): a date given alone is stored at 00:00 with its flag false, and
  every reader shows the date alone — never midnight. Form values are
  "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM" (`hasTime`); the parser keeps a date
  with no time as a date. A known 00:00 is a real midnight.
- Booking times are wall-clock at the place stored as if UTC
  (`vault/actions.ts` `stamp`); every reader slices or formats in UTC.
- `crypto.ts` is AES-256-GCM with a random nonce per record and a version
  prefix on the stored string. A reference is decrypted only to render it
  for its owner. Never log one, never put one in a prompt, never widen
  `VaultBooking.reference` to a list view.
- Without `BENTO_BOOKING_REF_KEY` the vault saves everything except the
  reference and says so. It never falls back to storing one in the clear.
- `parse.ts` runs Haiku 4.5 with **no tools**, no trip state and no
  history — that is the whole mitigation for prompt injection via an
  upload (§15). Never add a tool to that call. The output is schema-
  validated and only ever fills a form the traveller reviews.

## Transit (P3)

- `src/lib/transit/` is pure: `buildGraph` + `route` + `describeRoute`.
  Search state is (station, line); a line change pays `transferPenaltyMin`
  (default 5). Walks never pay it — the walk is the transfer.
- Line names include the service where it matters: "JR Nara Line · Local"
  and "JR Nara Line · Miyakoji Rapid" are different lines.
- Fares: a run of consecutive edges on one operator sums km and takes one
  band from `fares.ts`. An edge with `fareJpy` set is exact and stands
  alone. `fareKind: "estimate"` must render as `~¥`. A run with no fare
  table or no km is counted in `unpricedRides`, never charged ¥0 or
  shown as "free".
- `seed/kansai-sanyo.ts` is the one source of truth for the corridor; the
  tests, the CLI and `supabase/seed_transit.sql` all derive from it. Never
  edit the SQL by hand.

## Walkthrough

- `src/components/tour/`: one short tour per page (`steps.ts`), started on first
  visit. Settings → "Show the tour again" (`replayTours`) clears the cookie
  so each tour starts again; there is no Tour button in the header. A step points at
  `data-tour="<name>"` on the page, or is a centred card if that element
  isn't there. If you rename or remove one of those anchors, update the step.
- Seen state is a cookie (`bento_tour`, read on the server so nothing flashes
  in); the tour only points and never changes data. Copy follows the voice
  rule below.

## Voice

Bento Man is a local friend who knows the place and will tell you the truth
about it (§04). Not a mascot. No enthusiasm as filler, no emoji in plan
content, no confident prose where a fact is missing. Warmth comes from
usefulness, not tone.

## Conventions

- Every word a page shows lives in `src/copy/en.ts` (`import { copy } from
  "@/copy"`). No text in components, actions or error helpers: add a line
  there. A sentence with a value in it is a function, so word order stays in
  the file. `copy.test.ts` refuses empty lines and internal words (stub,
  tier…). Not in it: Bento Man's prompt (instructions to the model) and place
  data (the database). A second language is a file satisfying `Copy`.
  Dates are written with `copy.locale`. Server set-up problems (a missing
  key) are logged with the variable name; the traveller gets plain words.
  The planner's sentences (reasons, left-out details, warnings, gap cards,
  route arithmetic, date refusals) are in `copy.plan`; the engine imports
  only that plain module, so it stays framework-free. Not in it: Bento
  Man's instructions and trip state (`prompt.ts`, `context.ts`, tool
  descriptions — changing those needs the eval) and the admin pages.
- Server Components by default; `"use client"` only where interaction needs it.
- Server actions for mutations, with Zod validation at the boundary.
- Tailwind v4 theme tokens in `globals.css` — use `text-ink-2`, `bg-surface`,
  `border-rule` rather than raw colours.
- The logo is `src/components/logo.tsx` (`<BentoMark>`, `<BentoLogo>`); the
  SVG masters are in `public/logo/`. Every PNG — favicons, PWA icons,
  apple-icon, the social card — is generated by `scripts/render-icons.mjs`.
  Never hand-edit a raster; change the master and re-render.
- `npm run typecheck` runs `next typegen` first; Next 16's `PageProps` and
  `LayoutProps` are generated, so bare `tsc` fails on a clean checkout.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
