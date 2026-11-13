---
type: overview
status: draft
last_reviewed: 2026-11-13
---

# Open questions

Where the original spec, the notes and the code disagree, or where something planned isn't built. Each needs a decision from the owner; until then, **the code is what travellers get**. Decided items move to [decisions](../70-decisions/README.md).

## Spec vs code

| # | Question | Spec says | Code does | Where |
|---|---|---|---|---|
| Q1 | Who owns the preference profile? | One profile per **trip** (D9) | `user_preferences` is keyed by the **account** | [D9](../70-decisions/d09-party-model.md) |
| Q2 | Transit data source | GTFS-JP and ODPT feeds | Hand-built seeds; ODPT can't be used from a public repo | [transit](../30-software/transit.md) |
| Q3 | Which model runs Bento Man | Opus 5 first (D8) | Code default Anthropic; production set to Gemini | [D8](../70-decisions/d08-own-the-reasoning.md) |
| Q4 | UI kit | Tailwind and shadcn/ui | Tailwind with Bento's own components | [architecture](../30-software/architecture.md) |
| Q5 | Coverage thresholds | deep 40+, outline 10–20 | deep 25, outline 8 | [coverage](../10-product/coverage.md) (decided: the code wins, manifest C6) |

## Planned but not built

| # | What | From | Note |
|---|---|---|---|
| Q6 | An offline "today" view | Spec §03 (step 7), §13 (P8) | The plan can be printed or saved as a PDF, and shared; no offline view in the app |
| Q7 | Logistics verdicts: JR Pass break-even, cash | Spec §03 (step 5), §12 | Not built |
| Q8 | Luggage rules: reserved seats for big cases, forwarding | Spec §12 | Not built |
| Q9 | Arrival checklist (IC card), peak-week date check, Kyoto transit preference | Spec §12 | Not built |
| Q10 | Re-verify queue ordered by usage | Spec §10 | Not confirmed in the code |

## Known gaps found while documenting

| # | Gap | Note |
|---|---|---|
| Q11 | "Make a new link" is two steps; if the second fails, the trip is left not shared | [trip sharing](../10-product/trip-sharing.md); a code fix would make it one database step |

## From the spec's own "still open" list

| # | Question | State |
|---|---|---|
| O1 | Evaluation set design | Built: about 30 scenarios ([Bento Man (software)](../30-software/bento-man.md)). The "Sonnet 5 holds" test (D8) hasn't been run |
| O2 | Monetisation | Tracked in the private vault |
| O3 | Scoring weights | Still the seed values ([engine](../30-software/engine.md)) |
