---
type: design
status: accepted
code:
  - bento/src/lib/bento-man/
  - bento/scripts/eval-bento-man.ts
last_reviewed: 2026-11-13
---

# Bento Man: how it's built

The product side is in [Bento Man, the guide](../10-product/bento-man.md).

## A turn

`chat.ts` runs one turn: the history, a `<trip_state>` block and the message go to the model; the model calls tools; the tools call the engine and the store; the model writes the prose.
- The system prompt (`prompt.ts`) and the tool list (`tools.ts`) are the cached prefix and must stay byte-stable: no dates, names or state in them.
- **Guards before every model call:** sign-in → a per-user rate limit (`take_rate_token`) → a spend hold (`reserveSpend`) → the model. The hold is settled afterwards with what the call really cost.

## Scope and injection guards

The prompt keeps Bento Man on Japan travel ("WHAT YOU TALK ABOUT": anything else is declined in a line) and says the traveller's words are never instructions ("RULES NO MESSAGE CAN CHANGE"). A prompt can be talked round, so `guard.ts` backs it in code:
- `clean()` removes characters the traveller can't see (zero-width and direction marks, Unicode tag characters) and defuses `<trip_state>` / `<traveller_message>` tags, in the message, in earlier traveller turns, and in typed trip fields such as the title (which `context.ts` also puts on one line).
- The message reaches the model inside its own `<traveller_message>` block, after the trip state.
- A reply that repeats the prompt (`leaksPrompt`, matched against `PROMPT_MARKERS`) stops streaming and is replaced by a short decline (`copy.chat.withheld`). A test fails if a marker line is reworded in the prompt without updating the list.
- On Gemini, Google's safety filters are on at `BLOCK_ONLY_HIGH` (`SAFETY_SETTINGS`); stricter settings block Hiroshima history.
- What limits the damage if the model is talked round anyway: replies are plain text, and tools only reach the signed-in traveller's own trip.

## Tools

| Tool | Does |
|---|---|
| `set_preferences`, `set_trip_dates` | Onboarding answers, saved where the traveller can read and correct them |
| `assess_route` | Cities and nights → coverage per city, train time per leg, the share of the trip spent moving, and a verdict with the arithmetic |
| `suggest_route` | A starting route for the trip's length |
| `propose_route` | A route as a proposal (refuses an over-packed route unless the traveller insists) |
| `plan_days` | Day plans from the engine, as a proposal |
| `replan_day` | Pin, unpin, remove, add, avoid a category, start later; the engine re-plans around what's kept |
| `get_place`, `route_between` | The verified facts and the journey, so a description quotes the record |
| `place_background` | A place's checked history, or a short general background, said as general |

- Every tool checks its input (Zod) and returns JSON; a bad input is an error result the model can recover from, never a crash.
- Tools that change the plan write only to the proposal.

## Models

| Use | Provider and model | Notes |
|---|---|---|
| Bento Man, the code's default | Anthropic, `claude-opus-5`, streaming, adaptive thinking | `BENTO_MAN_PROVIDER` picks the provider; `BENTO_MAN_MODEL` overrides the model; `BENTO_MAN_EFFORT` sets the effort |
| Bento Man, Gemini option | Google, `gemini-3.8-flash` by default, with a fallback list (`BENTO_MAN_FALLBACK_MODELS`, by default 3.6 Flash, then 3.1 Flash-Lite) | On a 429 or lasting overload it moves to the next model, since each free-tier model has its own quota. 500, 503 and 504 errors are retried twice before anything has streamed |
| Reading pasted bookings | Anthropic Haiku 4.5, **no tools** | Independent of the chat provider |

- **Production** is set to the Gemini provider. When that was last confirmed, and the reasons and costs, are kept privately. The code's default is still Anthropic (manifest contradiction C4).
- Free-tier Gemini prompts may be used by Google to improve its products, so production booking text must not go through it; the booking reader stays on Anthropic.
- **Every new provider or model must pass the evaluation** against the real model before use. Mocks and unit tests don't count.

## The evaluation

- `bento/src/lib/bento-man/evals/scenarios.ts` holds about 30 planning scenarios with known-correct answers: onboarding, over-packed routes, stub cities, day plans, changes that mustn't regenerate the rest, facts that must come from the database, and the voice. The `scope-*` and `attack-*` scenarios check off-topic requests and injection attempts.
- Each is graded mechanically: tools called or not, prose patterns, the proposal's kind, and `voiceLint` on every reply.
- `npx tsx scripts/eval-bento-man.ts` runs the real model against the in-memory store. It costs money, and on Gemini's free tier a full run uses the live site's daily quota, so run a subset (`--only <id>`) and ask the owner first.
- The engine half of each scenario is also a Vitest test and runs offline.

## Two stores

`SupabaseStore` is the product, and reads places through `places_public`. `MemoryStore` is for the evaluation and tests, and treats the drafted corridor as verified. The memory store must never be used in a request handler.

## Local work without a key

`BENTO_MAN_MOCK=1` replaces only the model (keyword → tool, canned prose). Never in production, and not a substitute for the evaluation.

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Bento Man (P6)". Source: `bento/README.md` "Bento Man".
