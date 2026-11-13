# Migration manifest

Where every existing Bento document, and every section of the large ones, moves in the docs vault. This is the to-do list for PRs C and D. Nothing is archived or deleted until its row says `done` or `kept`.

**Status values:**
- `todo`: not moved yet;
- `done`: moved, and the destination note exists;
- `kept`: stays where it is, and the reason is given.

Destination paths are relative to `docs/bento/`. Design: [the vault design](../../superpowers/specs/2026-11-13-bento-docs-vault-design.md).

## Documents

### `docs/spec.html`, the original design spec (18 sections)

| Source | Section | Destination | Kept in place | Status |
|---|---|---|---|---|
| spec.html | §01 What this actually is | 10-product/vision.md; summary on docs/README.md |  | todo |
| spec.html | §02 Decisions taken (D1–D8) | 70-decisions/, one note per decision |  | todo |
| spec.html | §03 The traveller's line | 10-product/traveller-journey.md, plus links to each feature note |  | todo |
| spec.html | §04 Division of labour | 30-software/division-of-labour.md |  | todo |
| spec.html | §05 The engine | 30-software/engine.md |  | todo |
| spec.html | §06 Coverage, all of Japan, honestly | 10-product/coverage.md |  | todo |
| spec.html | §07 What "local guide" means in the data | 30-software/place-data.md |  | todo |
| spec.html | §07 Transit legs are described, not timed | 30-software/transit.md |  | todo |
| spec.html | §08 Feedback, diffs not regeneration | 10-product/proposals-and-diffs.md |  | todo |
| spec.html | §09 Architecture | 30-software/architecture.md |  | todo |
| spec.html | §10 How 2,000 records get written | 50-operations/curation.md |  | todo |
| spec.html | §11 Gaps the traveller can understand | 10-product/booking-vault.md |  | todo |
| spec.html | §12 Japan rules the engine must encode | 30-software/japan-rules.md |  | todo |
| spec.html | §13 Build order | 90-archive (historical); current state in 00-start/status.md |  | todo |
| spec.html | §14 Cost, and the mobile path | 40-non-functional/costs.md; 60-direction/mobile.md |  | todo |
| spec.html | §15 Risks | 60-direction/risks.md (product and engineering risks); business risks to bento-private |  | todo |
| spec.html | §16 User zero | **bento-private** (a personal travel profile, not for a public repo); the public note keeps only "designed against a real first traveller" |  | todo |
| spec.html | §17 Still open | 00-start/open-questions.md |  | todo |

### `bento/README.md` (14 sections)

| Source | Section | Destination | Kept in place | Status |
|---|---|---|---|---|
| bento/README.md | What exists so far | 00-start/status.md |  | todo |
| bento/README.md | Setup | 50-operations/local-setup.md | A five-line quick start stays in the README | todo |
| bento/README.md | Deploying | 50-operations/deploying.md |  | todo |
| bento/README.md | Curation | 50-operations/curation.md |  | todo |
| bento/README.md | The day view | 10-product/day-view.md |  | todo |
| bento/README.md | The vault | 10-product/booking-vault.md |  | todo |
| bento/README.md | Bento Man | 10-product/bento-man.md; 30-software/bento-man.md |  | todo |
| bento/README.md | Commands | 30-software/commands.md | Also linked from the quick start | todo |
| bento/README.md | The engine | 30-software/engine.md |  | todo |
| bento/README.md | Transit | 30-software/transit.md |  | todo |
| bento/README.md | Logo | 20-design/logo.md |  | todo |
| bento/README.md | Two rules the code holds to | 30-software/division-of-labour.md |  | todo |
| bento/README.md | Layout | 30-software/layout.md |  | todo |
| bento/README.md | Coverage tiers | 10-product/coverage.md |  | todo |

### `docs/PROGRESS.md` (10 sections)

| Source | Section | Destination | Kept in place | Status |
|---|---|---|---|---|
| PROGRESS.md | The shape of the thing | 90-archive/progress-history.md |  | todo |
| PROGRESS.md | Phases | 00-start/status.md (current); 90-archive/progress-history.md (history) |  | todo |
| PROGRESS.md | What a traveller can do today | 00-start/status.md |  | todo |
| PROGRESS.md | Code review, and what came of it | 90-archive/progress-history.md |  | todo |
| PROGRESS.md | Before this works end to end | 00-start/status.md (open items) |  | todo |
| PROGRESS.md | Verification status | 00-start/status.md |  | todo |
| PROGRESS.md | What P8 actually holds | 10-product/booking-vault.md |  | todo |
| PROGRESS.md | Open, and next | 00-start/status.md; 60-direction/README.md |  | todo |
| PROGRESS.md | Pre-launch engineering (12 October 2026) | 90-archive/progress-history.md; lasting rules to 40-non-functional/ |  | todo |
| PROGRESS.md | UI pass and full-codebase review (12 October 2026) | 90-archive/progress-history.md |  | todo |

### `bento/DESIGN.md` (tokens plus 11 sections)

| Source | Section | Destination | Kept in place | Status |
|---|---|---|---|---|
| bento/DESIGN.md | Tokens (frontmatter) |  | Developers and agents read it next to the code; 20-design/README.md links it | kept |
| bento/DESIGN.md | Overview, Colors, Typography, Layout, Elevation, Components, Motion |  | The design system's prose stays in DESIGN.md; 20-design/README.md summarises and links | kept |
| bento/DESIGN.md | Bento Man, the figure | 20-design/bento-man-figure.md (explains); DESIGN.md keeps the rules |  | todo |
| bento/DESIGN.md | Seasonal backdrop | 20-design/seasonal-backdrop.md (explains); DESIGN.md keeps the rules |  | todo |
| bento/DESIGN.md | Voice | 20-design/voice.md |  | todo |
| bento/DESIGN.md | Known Gaps | 20-design/README.md, open design questions |  | todo |

### `bento/CLAUDE.md` (16 sections)

It stays where it is, and its rules stay in it **with their conditions and exceptions**. Only reasons, history and long detail move to the notes listed under "Rules in bento/CLAUDE.md" below.

| Source | Section | Destination | Kept in place | Status |
|---|---|---|---|---|
| bento/CLAUDE.md | All 16 sections | Explanations to the notes per rule below | The rules themselves (Claude loads this file into every session) | todo |
| bento/CLAUDE.md | "This is NOT the Next.js you know" |  | Kept as is; `next dev` writes it | kept |

### Other documents

| Source | Section | Destination | Kept in place | Status |
|---|---|---|---|---|
| bento/AGENTS.md | Whole file |  | Codex's entry point; its PROGRESS.md pointer changes to the start page and status page (Task 9) | todo |
| AGENTS.md, CLAUDE.md, GEMINI.md (root) | Whole files |  | Identical agent entry points; the docs rule is added in Task 10 | todo |
| README.md (root) | Whole file |  | Links docs/README.md | done |
| design/README.md | Whole file | 20-design/README.md (screens list, with status) | A short pointer stays next to the mock-ups | todo |
| design/ (7 mock-ups, `_shared_head.txt`, `canvas.json`) | Each file |  | They stay in design/; each is listed in 20-design/README.md as current, exploratory or inspiration | todo |
| docs/design-references/ (README and 3 references) | Each file | 20-design/inspiration/ |  | todo |
| docs/superpowers/ (2 earlier designs, their plans, the Bento Man art, and this vault's design and plan) | Each file |  | They stay where they are, as dated designs and plans; linked from 90-archive/README.md | todo |
| docs/spec.html | Whole file | 90-archive/spec.html, once every section row above is done |  | todo |
| docs/PROGRESS.md | Whole file | Replaced by a "Moved to" note, then removed (Task 11) |  | todo |

## Rules in bento/CLAUDE.md

All 120 rule bullets, by section. "Rule" is the start of the bullet. In Task 9, each bullet keeps its conditions and exceptions in `bento/CLAUDE.md` and gains a link to the note that explains it. After the change, every row must still read `yes`.

| # | Section | Rule (start of the bullet) | Explained in | Still in CLAUDE.md |
|---|---|---|---|---|
| R1 | The one idea that shapes everything | Durations, fares, opening hours, travel times → the engine, always. | 30-software/division-of-labour.md | yes |
| R2 | The one idea that shapes everything | The model may never state a fact it was not handed. | 30-software/division-of-labour.md | yes |
| R3 | The one idea that shapes everything | The model proposes diffs; it never writes the itinerary directly. | 30-software/division-of-labour.md | yes |
| R4 | The one idea that shapes everything | Opus 5 first, Sonnet 5 only once the eval holds (D8). | 30-software/division-of-labour.md | yes |
| R5 | Invariants | Nothing unverified reaches a traveller. Judgement fields on `places` are | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R6 | Invariants | Every new view gets an explicit `revoke insert, update, delete … from | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R7 | Invariants | Redirects after sign-in go through `safeNext` (`lib/safe-next.ts`). | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R8 | Invariants | Supabase is only ever called from the server. The session cookies are | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R9 | Invariants | Every password, reset and two-factor attempt passes `authGate` | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R10 | Invariants | Every way to create an account passes the age screen (`lib/age-gate.ts`, | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R11 | Invariants | Analytics only with consent, and never content. PostHog (EU) starts | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R12 | Invariants | CSP is enforced. The policy lives in `src/lib/security/csp.ts`; a | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R13 | Invariants | An email link never signs straight in. A `token_hash` link works in | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R14 | Invariants | Deleting an account removes everything of theirs (Settings → Privacy | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R15 | Invariants | RLS on every user table. Never reach for the service-role client to work | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R16 | Invariants | RLS lets a traveller write their own rows straight over PostgREST, past | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R17 | Invariants | Every new `SECURITY DEFINER` function sets `search_path = public, pg_temp` | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R18 | Invariants | Costs are stored in JPY. Conversion happens on read, so a stale rate can | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R19 | Invariants | Budget lives on `trip_cities`, not `trips` — a ryokan night in Hakone | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R20 | Invariants | `excludes` is a hard filter, applied before scoring. "No beaches" means | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R21 | Invariants | A booking reference is encrypted at rest, never logged, and never | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R22 | Invariants | Reserve spend before every model call (`reserveSpend`, 0014), sized to | 40-non-functional/ (security, privacy, costs) and 30-software/ notes per rule | yes |
| R23 | Engine (P4) | Pure functions in `src/lib/engine/`. No framework, no network, no model. | 30-software/engine.md | yes |
| R24 | Engine (P4) | `scorePlace` (Fig. 1) returns a breakdown; every term that moved the | 30-software/engine.md | yes |
| R25 | Engine (P4) | `planDay` (Fig. 2): budget → filter → anchor → grow → order → time → | 30-software/engine.md | yes |
| R26 | Engine (P4) | Hard rules live in `filter.ts` and never become penalties: stub tier, | 30-software/engine.md | yes |
| R27 | Engine (P4) | The anchor holds position 0 through growth and ordering. Timed pins are | 30-software/engine.md | yes |
| R28 | Engine (P4) | Scores shown on items are recomputed against the final order, so "your | 30-software/engine.md | yes |
| R29 | Engine (P4) | Known gaps: windows are soft except for the anchor; a place with no | 30-software/engine.md | yes |
| R30 | Engine (P4) | Tests: `src/lib/engine/__tests__`, fixtures in `__fixtures__/kyoto.ts`. | 30-software/engine.md | yes |
| R31 | Curation data (P5) | `src/lib/places/seed/<city>.ts` is the source of truth for drafted | 50-operations/curation.md | yes |
| R32 | Curation data (P5) | Every seed record lands with `verification_status = 'draft'` and the | 50-operations/curation.md | yes |
| R33 | Curation data (P5) | A `station` in a seed record must be a station id in the transit seed | 50-operations/curation.md | yes |
| R34 | Curation data (P5) | `conflicts` and `pairs` must point at existing ids in the same batch; | 50-operations/curation.md | yes |
| R35 | Curation data (P5) | Hours are same-day: `closes` must be after `opens`. An overnight venue | 50-operations/curation.md | yes |
| R36 | Curation data (P5) | Seasonal hours are never promised (0026): a place whose hours change | 50-operations/curation.md | yes |
| R37 | Curation data (P5) | Prices are shown as bands, never figures (`engine/cost-band.ts`: free, | 50-operations/curation.md | yes |
| R38 | Curation data (P5) | Categories are free text but keep to the list in `seed/types.ts`; | 50-operations/curation.md | yes |
| R39 | Curation data (P5) | `/admin/review` is the sign-off queue. `verifyPlace` redirects to the | 50-operations/curation.md | yes |
| R40 | Curation data (P5) | `/admin/review/bulk` verifies many drafts at once (`verifyPlaces`). It uses | 50-operations/curation.md | yes |
| R41 | Curation data (P5) | Where the AI reviewers (Codex and Gemini) disagree about a drafted field, | 50-operations/curation.md | yes |
| R42 | Curation data (P5) | Backgrounds (0027) are a place's lasting story: history and what it is | 50-operations/curation.md | yes |
| R43 | Bento Man (P6) | `src/lib/bento-man/`. `chat.ts` runs one turn: history + a | 30-software/bento-man.md | yes |
| R44 | Bento Man (P6) | `provider.ts` is the model-call boundary. `BENTO_MAN_PROVIDER` selects | 30-software/bento-man.md | yes |
| R45 | Bento Man (P6) | The Anthropic provider calls `claude-opus-5` through the beta client with | 30-software/bento-man.md | yes |
| R46 | Bento Man (P6) | Gemini uses REST streaming and defaults to `gemini-3.8-flash` (`2.5-flash` | 30-software/bento-man.md | yes |
| R47 | Bento Man (P6) | Every new provider must pass `scripts/eval-bento-man.ts` against the real | 30-software/bento-man.md | yes |
| R48 | Bento Man (P6) | Every tool validates its input with Zod and returns a JSON string. A | 30-software/bento-man.md | yes |
| R49 | Bento Man (P6) | A `Proposal` (`diff.ts`) is validated on the way into `chat_messages` | 30-software/bento-man.md | yes |
| R50 | Bento Man (P6) | `TripStore` has two implementations. `SupabaseStore` is the product and | 30-software/bento-man.md | yes |
| R51 | Bento Man (P6) | `city_coverage` is the traveller-safe view for tiers and verified | 30-software/bento-man.md | yes |
| R52 | Bento Man (P6) | Accepting a proposal (`apply_proposal`) and changing the dates | 30-software/bento-man.md | yes |
| R53 | Bento Man (P6) | Moving dates the trip already has is a proposal (`Proposal.dates`, #6), | 30-software/bento-man.md | yes |
| R54 | Bento Man (P6) | Guards before every model call: auth → `rateLimit` (Postgres, `take_rate_token`; … | 30-software/bento-man.md | yes |
| R55 | Bento Man (P6) | "Plan a Japan trip" (`trips/plan`, `startGuidedTrip`, `lib/trips/guided-start.ts`) … | 30-software/bento-man.md | yes |
| R56 | Bento Man (P6) | `mock.ts` is a fake client for local work without a key | 30-software/bento-man.md | yes |
| R57 | Bento Man (P6) | The eval (`evals/scenarios.ts`, `scripts/eval-bento-man.ts`) is the | 30-software/bento-man.md | yes |
| R58 | Bento Man (P6) | The model never sees tier names. The trip state and tool results say how | 30-software/bento-man.md | yes |
| R59 | Bento Man (P6) | `place_background` is the one place general knowledge is allowed, and | 30-software/bento-man.md | yes |
| R60 | Bento Man (P6) | An overpacked route is a conversation before it is a proposal: | 30-software/bento-man.md | yes |
| R61 | Day view (P7) | `src/app/trips/[id]/day-box.tsx` is the box; `day-actions.ts` are the | 10-product/day-view.md | yes |
| R62 | Day view (P7) | `retimeDay` makes no choices: the order is the traveller's, the times | 10-product/day-view.md | yes |
| R63 | Day view (P7) | `engine/day-stats.ts` sums what is stored for the view (active time, | 10-product/day-view.md | yes |
| R64 | Day view (P7) | Map and Directions links (`lib/maps/links.ts`) are plain Google Maps | 10-product/day-view.md | yes |
| R65 | Day view (P7) | Palette and motion live in `globals.css`: `paper`/`surface`/`sunk`/ | 10-product/day-view.md | yes |
| R66 | Day view (P7) | Fonts are fontsource packages imported in `layout.tsx` — no build-time | 10-product/day-view.md | yes |
| R67 | Day view (P7) | The seasonal scenes and particles (`components/seasonal/`) are the one | 10-product/day-view.md | yes |
| R68 | Day view (P7) | Which season shows: `?season=` preview, then Settings → Appearance → Background (the | 10-product/day-view.md | yes |
| R69 | Day view (P7) | No `backdrop-filter` or `filter` on anything that animates or sits over | 10-product/day-view.md | yes |
| R70 | Day view (P7) | `DESIGN.md` is the design system in prose and tokens: read it before UI | 10-product/day-view.md | yes |
| R71 | Day view (P7) | The dark palette overrides variables on `:root` inside the media query. | 10-product/day-view.md | yes |
| R72 | Day view (P7) | Settings → Appearance → Theme (System / Light / Dark) is the `bento_theme` cookie | 10-product/day-view.md | yes |
| R73 | After the trip | From a trip's last day on (UTC date, the same as the database's | 10-product/trip-review.md | yes |
| R74 | After the trip | The first answer saves the plan as it stood (`plan`): the database makes | 10-product/trip-review.md | yes |
| R75 | Names and admins | Settings is a short list (`settings/page.tsx`): each row says what's set | 10-product/accounts-and-admins.md | yes |
| R76 | Names and admins | A traveller's name is optional (sign-up, Settings → Personal information) and lives in | 10-product/accounts-and-admins.md | yes |
| R77 | Names and admins | Settings → Admin (`settings/admin`) is for admins only (`isAdmin` in | 10-product/accounts-and-admins.md | yes |
| R78 | Names and admins | Admin pages and actions also need a second factor this session | 10-product/accounts-and-admins.md | yes |
| R79 | Legal pages | `/privacy`, `/terms`, `/cookies` and `/about` (who runs Bento) are public | 40-non-functional/privacy.md | yes |
| R80 | Legal pages | The operator's name and contact are the constants at the top of | 40-non-functional/privacy.md | yes |
| R81 | Legal pages | Keep them true to the code. A new cookie gets a row in `copy.cookies`; a | 40-non-functional/privacy.md | yes |
| R82 | Legal pages | Sign-up names the terms and the privacy policy under both ways in (email | 40-non-functional/privacy.md | yes |
| R83 | Legal pages | No claim the data can't back: places and train times are seed values | 40-non-functional/privacy.md | yes |
| R84 | Sharing | A traveller can share a trip with their companions by link (0020, | 10-product/trip-sharing.md | yes |
| R85 | Sharing | The token is the only key: 32 hex characters made by the database. The | 10-product/trip-sharing.md | yes |
| R86 | Sharing | `/shared/[token]` reads the plan from `shared_trip()` alone (definer | 10-product/trip-sharing.md | yes |
| R87 | Sharing | The shared page is the download's sheet (`components/plan/plan-sheet.tsx`, | 10-product/trip-sharing.md | yes |
| R88 | Sharing | The address is the key, so no analytics start on `/shared/…` (and the | 10-product/trip-sharing.md | yes |
| R89 | The vault (P8) | `src/lib/vault/`. `gaps.ts` is pure and testable: trip dates, route, | 10-product/booking-vault.md | yes |
| R90 | The vault (P8) | A gap's `key` is stable across runs, because a dismissal is stored | 10-product/booking-vault.md | yes |
| R91 | The vault (P8) | The detector must distinguish *never needed a booking* from *not booked | 10-product/booking-vault.md | yes |
| R92 | The vault (P8) | Severities: `blocking` (the trip does not work), `closing` (a window is | 10-product/booking-vault.md | yes |
| R93 | The vault (P8) | Whether a booking holds a place's ticket is `match.ts`, shared by the | 10-product/booking-vault.md | yes |
| R94 | The vault (P8) | A booking joins the plan when the traveller drags it into one of its | 10-product/booking-vault.md | yes |
| R95 | The vault (P8) | A booking time can be unknown (`starts_time_known` / `ends_time_known`, | 10-product/booking-vault.md | yes |
| R96 | The vault (P8) | Booking times are wall-clock at the place stored as if UTC | 10-product/booking-vault.md | yes |
| R97 | The vault (P8) | `crypto.ts` is AES-256-GCM with a random nonce per record and a version | 10-product/booking-vault.md | yes |
| R98 | The vault (P8) | Without `BENTO_BOOKING_REF_KEY` the vault saves everything except the | 10-product/booking-vault.md | yes |
| R99 | The vault (P8) | `parse.ts` runs Haiku 4.5 with no tools, no trip state and no | 10-product/booking-vault.md | yes |
| R100 | The vault (P8) | Before that call, `redact.ts` takes out labelled booking references, | 10-product/booking-vault.md | yes |
| R101 | Transit (P3) | Travellers see the trains between stops twice: on a route proposal | 30-software/transit.md | yes |
| R102 | Transit (P3) | `src/lib/transit/` is pure: `buildGraph` + `route` + `describeRoute`. | 30-software/transit.md | yes |
| R103 | Transit (P3) | Line names include the service where it matters: "JR Nara Line · Local" | 30-software/transit.md | yes |
| R104 | Transit (P3) | Fares: a run of consecutive edges on one operator sums km and takes one | 30-software/transit.md | yes |
| R105 | Transit (P3) | `seed/kansai-sanyo.ts` is the one source of truth for the corridor; the | 30-software/transit.md | yes |
| R106 | Transit (P3) | `seed/tokyo.ts` is Tokyo's core network (every Metro, Toei and Yamanote | 30-software/transit.md | yes |
| R107 | Walkthrough | `src/components/tour/`: one short tour per page (`steps.ts`), started on first | 10-product/walkthrough.md | yes |
| R108 | Walkthrough | Seen state is a cookie (`bento_tour`, read on the server so nothing flashes | 10-product/walkthrough.md | yes |
| R109 | Bento Man's figure | `src/components/mascot/`: the animated guide (DESIGN.md → "Bento Man, the | 20-design/bento-man-figure.md | yes |
| R110 | Bento Man's figure | Use `<BentoManFigure figure="…" size={…} />` (`figure.tsx`). It renders | 20-design/bento-man-figure.md | yes |
| R111 | Bento Man's figure | After its intro a figure rests still on the first idle frame (WCAG 2.2.2: | 20-design/bento-man-figure.md | yes |
| R112 | Bento Man's figure | Frame 0 of every figure is its still pose and every loop is seamless — | 20-design/bento-man-figure.md | yes |
| R113 | Bento Man's figure | His art is illustration with its own palette, like the logo and the | 20-design/bento-man-figure.md | yes |
| R114 | Bento Man's figure | He is decoration (`aria-hidden`); what he goes with stays as text. The | 20-design/bento-man-figure.md | yes |
| R115 | Conventions | Every word a page shows lives in `src/copy/en.ts` (`import { copy } from | 30-software/conventions.md | yes |
| R116 | Conventions | Server Components by default; `"use client"` only where interaction needs it. | 30-software/conventions.md | yes |
| R117 | Conventions | Server actions for mutations, with Zod validation at the boundary. | 30-software/conventions.md | yes |
| R118 | Conventions | Tailwind v4 theme tokens in `globals.css` — use `text-ink-2`, `bg-surface`, | 30-software/conventions.md | yes |
| R119 | Conventions | The logo is `src/components/logo.tsx` (`<BentoMark>`, `<BentoLogo>`); the | 30-software/conventions.md | yes |
| R120 | Conventions | `npm run typecheck` runs `next typegen` first; Next 16's `PageProps` and | 30-software/conventions.md | yes |

## Contradictions

Where existing documents disagree with each other or with the code. Each needs the owner's answer before the content move (PR C).

| # | Where | The disagreement | Proposed answer | Owner decision |
|---|---|---|---|---|
| C1 | `design/README.md` line 7 vs `bento/DESIGN.md` and `globals.css` | design/README.md lists DM Sans for the body and Zen Maru Gothic for Japanese only. DESIGN.md and the code use Zen Maru Gothic for headlines and Zen Kaku Gothic New for the body | DESIGN.md and `globals.css` win; design/README.md marks the mock-ups' fonts as an earlier exploration |  |
| C2 | `bento/CLAUDE.md` lines 3–4 and `docs/PROGRESS.md` line 5 | Both call `spec.html` "the source of truth", while DESIGN.md and CLAUDE.md elsewhere name `globals.css`, the seeds and the migrations as sources of truth | Replace both with a link to [which file wins](../00-start/which-file-wins.md); spec.html becomes the original intent |  |
| C3 | `docs/PROGRESS.md` line 3 | "Last updated 16 September 2026, after P8" heads a page with November content (the Tokyo move) | The new status page gets a real `last_reviewed`; PROGRESS.md is retired |  |
| C4 | `bento/README.md` lines 37, 174, 350 and `bento/CLAUDE.md` "Bento Man (P6)" vs the live settings | The docs say Bento Man runs Claude Opus 5 by default (D8: "Opus 5 first"). Production runs Gemini (`BENTO_MAN_PROVIDER=gemini`) on the free tier, because the Anthropic key had no credit | The docs describe both: the code's default is Anthropic, and production currently uses Gemini. D8's "Opus first" becomes a decision note marked as not followed yet, with the reason |  |
| C5 | `docs/spec.html` §16 User zero | A personal traveller profile sits in a public repo | Move it to bento-private. The archived spec keeps the section for now, because removing it from git history needs a separate decision |  |
| C6 | `docs/spec.html` §02 D2 ("whole of Japan at full depth") and §06 vs the data | Coverage today is the Kansai corridor (Kyoto, Osaka, Nara, Hiroshima, Miyajima) plus Tokyo | 10-product/coverage.md states today's coverage and the D2 target separately |  |
