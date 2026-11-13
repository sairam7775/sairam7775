---
type: non-functional
status: accepted
implementation: shipped
code:
  - bento/src/lib/guards/spend.ts
  - bento/src/lib/bento-man/cost.ts
  - bento/supabase/migrations/0014_spend_reservations.sql
last_reviewed: 2026-11-13
---

# Costs and caps

## Target

| # | Requirement |
|---|---|
| C1 | AI spend can never pass a **monthly project-wide cap** (`BENTO_MONTHLY_SPEND_CAP_USD`, default **$20**) or a per-user cap |
| C2 | A **spend hold** is taken before every model call, sized to the most that call can cost, and settled with what it really cost |
| C3 | Holds are taken under a database lock, so parallel requests see each other |
| C4 | A forgotten check can't spend money: `reserveSpend` throws instead of returning a flag |
| C5 | Every model call, including background drafting, is recorded in `api_usage` against the cap |

Details agents must keep:
- A request over the usual 40,000-token ceiling gets a hold its own size, never a smaller one.
- Input is priced at the dearer of the input and cache-write rates.
- A chat turn takes a hold per model call and ends politely when none is left.
- A call that never reached the model settles with nothing.
- Keep the price table in `cost.ts` current, or the cap lies. Gemini is priced at the paid rate even on the free tier, so the cap is conservative; Gemini's rate rises on 1 January 2027.

## How it's checked

- `bento/src/lib/guards/__tests__/spend.test.ts`.
- Settings → Admin shows this month's AI spend (the cap's own sum) and the live model.

## Evidence

- Migration `0014_spend_reservations.sql` (holds under a lock); `spend.ts`; `cost.ts`.

## Running costs (estimates from the original spec, not maintained)

| Item | Estimate |
|---|---|
| Model tokens per completed trip plan | $0.50–1.50 on Opus 5 with caching; lower on a cheaper model |
| Maps and transit | About $0: open data, built in |
| Supabase | $0 on the free plan, $25 a month on Pro |
| Vercel | $0 on Hobby, $20 a month on Pro |
| Curation | About 150 hours of work, the real cost of the project |

Actual costs, plans and billing are kept privately.

## Known gaps

- Performance and cost per trip haven't been measured against real use.
