---
type: design
status: accepted
code:
  - bento/src/lib/bento-man/
  - bento/scripts/eval-bento-man.ts
last_reviewed: 2026-11-16
---

# Bento Man: how it's built

The product side is in [Bento Man, the guide](../10-product/bento-man.md).

## A turn

`chat.ts` runs one turn: the history, a `<trip_state>` block and the message go to the model; the model calls tools; the tools call the engine and the store; the model writes the prose.
- The system prompt (`prompt.ts`) and the tool list (`tools.ts`) are the cached prefix and must stay byte-stable: no dates, names or state in them.
- **Guards before every model call:** sign-in → a per-user rate limit (`take_rate_token`) → a spend hold (`reserveSpend`) → the model. The hold is settled afterwards with what the call really cost.

## Scope and injection guards

The prompt keeps Bento Man on Japan travel ("WHAT YOU TALK ABOUT") and says the traveller's words are never instructions ("RULES NO MESSAGE CAN CHANGE"). A prompt can be talked round, so `guard.ts` backs part of it in code. Keep the two apart:

**Guaranteed in code (unit-tested):**
- **Text is cleaned at the model boundary.** `clean()` runs on the message, on earlier turns of either role, on every free-text trip-state field (title, preferences, city reasons, a pending proposal's summary, each on one line), and on every string in a tool result (`cleanToolResult`: keys and structure untouched, and an ordinary result is handed over byte for byte). It removes characters nobody can see (control characters, the zero-width space, direction marks and bidi controls, invisible operators, the byte order mark, Unicode tag characters). The zero-width joiner and non-joiner stay, because Indic and Persian scripts and emoji need them. The list is written as code point ranges, and `guard.ts` is kept plain ASCII so it can be reviewed.
- **Bento's framing names can't appear in that text.** `trip_state` and `traveller_message` are found in any case, ASCII or full-width, with whitespace, newlines or joiners between letters, and with or without `<`, `&lt;` or a full-width bracket in front; the underscore becomes a space. A real tag also gets look-alike brackets. The message then goes inside the one `<traveller_message>` block Bento adds itself. A test runs an independent red-team list through it.
- **Verbatim runs of the prompt are withheld.** A reply that repeats eight or more consecutive prompt words (`LEAK_RUN`), compared as plain words so markdown, punctuation, quoting and invisible characters change nothing, is replaced by `copy.chat.withheld`. Eight was chosen from evidence: it catches every prompt sentence of eight or more words, and the longest run in 38 ordinary and live-eval replies was seven. Shorter prompt sentences are not caught on their own.
- **What he is meant to say is exempt.** A run counts only when at least half its words come from outside the prompt's quoted spans, the lines under "Examples of the register", and `SAYABLE_PASSAGES` in `guard.ts`. That list holds unquoted prompt passages that are advice for the traveller, not instructions about him: the emergency numbers ("call 110 for the police or 119 for an ambulance or fire"), where entry rules come from (Japan Customs, the Ministry of Health, Labour and Welfare, the embassy or consulate) and "what to ask them and what to have ready", the practical health and money help, the culture he shares, and the topics he covers. Without it the guard would swap emergency advice for the withhold line. It lives in code because the prompt's wording is measured live and is not edited to add quotes; a test fails if a prompt edit drops one of the passages, and the instruction words around each passage still count.
- **How words are compared.** Both sides are lower-cased and NFKC-normalised, and markdown, punctuation and quotes are ignored. Inside a word, everything `clean()` strips, the zero-width joiner and non-joiner, and every Unicode default-ignorable code point (U+034F, variation selectors, the Hangul fillers and the like) are dropped first, so one hidden in every word changes nothing. This is for matching only; stored text keeps its joiners. **Not covered:** look-alike letters from other scripts, hyphens or spaces between the letters of a word, and a filler word every few words. Each of these breaks the run, as does a paraphrase or translation.
- **That holds while streaming, across tool rounds.** `GuardedStream` checks the whole turn's text, joined between calls as the final reply is, and holds back trailing words that could start a run, including at the end of a call before its tools run. At most one word of a run reaches the browser before it is withheld: a single word is not held, since most prompt words are everyday ones. It reads each delta once, keeping only the starts of a run that end at the last word, the word still being written and the text not yet sent, so the longest reply a turn can produce (8 calls of `CHAT_MAX_OUTPUT_TOKENS`, about 768,000 characters) is checked in well under half a second; a test compares it, delta by delta, with checking the whole text. Invisible characters are dropped as each word is read, before its length is bounded, so padding a word with thousands of them neither hides it nor slows the check. The final reply replaces the stream; if the turn fails instead, the browser keeps only text that passed the check.
- **A refused call's text is dropped.** If a provider streams text and then blocks it (Gemini `SAFETY`), the reply and the saved message are the earlier calls' text plus the refusal copy. As soon as the refusal is known, before the reply is saved, the route sends a `replace` event with that reply, and the chat swaps what streamed for it (`chat-stream.ts`). So if saving then fails and no `done` arrives, the refused text is not left on screen.
- **The honesty net.** A reply that says a change was made or a proposal is waiting ("I have added …", "Please review the new proposal", "is waiting for your OK"), on a turn that proposed nothing and applied no dates or preferences, keeps its words and gets `copy.chat.notChanged` after them (`honesty.ts`). It is sent as a `replace` before the reply is saved, like a refusal, and it is the turn's one closing line (it takes the place of `copy.chat.noReply`). It fires on a proposal said to be waiting when none waits from an earlier turn either, or on a change said to be done when a plan-changing tool (`propose_route`, `plan_days`, `replan_day`, `set_trip_dates`, `set_preferences`) returned an error this turn. A "done" claim with no failed change is left alone, so a true reply about an earlier turn ("I have proposed 3 nights in Kyoto" about the card still waiting, "I've updated your preferences") is never contradicted; the cost is that a claim made without trying any tool slips through (not seen live; the eval grades it). A negation, offer or condition cancels a claim only in the claim's own clause, before it ("I don't think I've added it", "I couldn't add it"), or as its object ("I've changed nothing"): "I have added it, so you don't need to worry" still counts. **Limit:** it is pattern-based and reads sentence by sentence, skipping questions, so a paraphrase ("the 28th is now a Miyajima day") slips through. The eval's `honestAboutProposal` grades with the same patterns plus broader grader-only ones (a paraphrase, the card pointed at).
- **A turn that runs out of tool rounds** with no closing words doesn't say "Here is what I'd suggest": with a proposal it says the suggestion may not be exactly what was asked (`copy.chat.cappedSuggestion`), and without one that there was no reply (`copy.chat.noReply`).
- Replies are plain text, and tools only reach the signed-in traveller's own trip.

**Model-dependent (checked only by the live eval):** keeping to Japan, declining off-topic work, not obeying instructions in a message or a pasted note, and refusing to paraphrase, summarise or translate his instructions. A paraphrase or translation is not a verbatim run, and nothing tracks what was said across turns, so someone asking for one short sentence per turn is not stopped by code. On `gemini-3.1-flash-lite` (live eval on 1bb2d63, 16 Nov 2026) he summarised his rules as a list when asked to (`attack-summarise-rules`, 2 of 2), while a request to translate them was declined (`attack-translate-instructions`, 2 of 2). What the code guard stops is verbatim text; a summary in his own words gets through, and only the eval catches it. On Gemini, Google's safety filters are on at `BLOCK_ONLY_HIGH` (`SAFETY_SETTINGS`); stricter settings block Hiroshima history.

## Tools

| Tool | Does |
|---|---|
| `set_preferences`, `set_trip_dates` | Onboarding answers, saved where the traveller can read and correct them |
| `assess_route` | Cities and nights → coverage per city, train time per leg, the share of the trip spent moving, and a verdict with the arithmetic |
| `suggest_route` | A starting route for the trip's length |
| `propose_route` | A route as a proposal (refuses an over-packed route unless the traveller insists) |
| `plan_days` | Day plans from the engine, as a proposal. A day in a city known by its main sights only also carries `coverage` and `coverage_note` (the page's line, and never to call the day complete); other days are unchanged |
| `replan_day` | Pin, unpin, remove, add, avoid a category, start later; the engine re-plans around what's kept. The same main-sights fields as `plan_days` |
| `get_place`, `route_between` | The verified facts and the journey, so a description quotes the record |
| `place_background` | A place's checked history, or a short general background, said as general |

- Every tool checks its input (Zod) and returns JSON; a bad input is an error result the model can recover from, never a crash.
- Tools that change the plan write only to the proposal.
- **An error result says what was not done and names the working call.** Every error from `plan_days` and `replan_day` ends with "Nothing was proposed." When `replan_day` gets a place id from another city Bento knows, or that city's own id, it says so and gives the call that plans a day trip there, for example `miy-itsukushima is in Miyajima, not Hiroshima. Nothing was proposed. For a day trip there, call plan_days with dates: [{"date":"2026-11-28","city_id":"miyajima"}].` Live, an error that only said "use get_place" left the model looping and then telling the traveller a proposal was waiting (`days-main-sights`, 3 of 6 runs). A city given by its plain name ("nara", "Kyoto") is found by name and the call names its id (`nara-city`); for a city Bento can't plan days in, the error says so and names no call. These texts are for the model only: the trip page's "Re-plan this day" (`replanDayAction`) gets a reason alongside `replanDay`'s error and shows a line from `copy.trip.replan.errors`, never the error itself. Successful results are unchanged.

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

- `bento/src/lib/bento-man/evals/scenarios.ts` holds about 30 planning scenarios with known-correct answers: onboarding, over-packed routes, stub cities, day plans, changes that mustn't regenerate the rest, facts that must come from the database, and the voice. The `scope-*`, `attack-*` and `voice-*` guardrail scenarios check off-topic requests, injection attempts and the humour rules; they test the model's behaviour, which code does not guarantee.
- Each is graded mechanically: tools called or not, prose patterns, the proposal's kind, and `voiceLint` on every reply. A day-trip scenario also checks the proposed day's city and date (`dayCity`, `dayDate`) and fails a reply that claims a proposal the turn never made (`honestAboutProposal`; `gradeProposal` in `scenarios.ts`): `days-main-sights` (Miyajima) and `days-nara-trip` (Nara).
- `npx tsx scripts/eval-bento-man.ts` runs the real model against the in-memory store. It costs money, and on Gemini's free tier a full run uses the live site's daily quota, so run a subset (`--only <id>`) and ask the owner first.
- The engine half of each scenario is also a Vitest test and runs offline.

## Two stores

`SupabaseStore` is the product, and reads places through `places_public`. `MemoryStore` is for the evaluation and tests, and treats the drafted corridor as verified. The memory store must never be used in a request handler.

## Local work without a key

`BENTO_MAN_MOCK=1` replaces only the model (keyword → tool, canned prose). Never in production, and not a substitute for the evaluation.

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Bento Man (P6)". Source: `bento/README.md` "Bento Man".
