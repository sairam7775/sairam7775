---
type: overview
status: accepted
code:
  - bento/src/
last_reviewed: 2026-11-13
---

# Where the code is

```
bento/
  src/
    app/
      (auth)/             sign-in, sign-up, password reset, and their actions
      auth/callback/      where Google and email links land
      auth/confirm/       "Is this your account?" for email links
      trips/              trip list and creation
      trips/[id]/         the trip page: day view, chat, sharing, review
      trips/[id]/vault/   bookings and gaps
      trips/[id]/print/   the plan sheet to print or save
      shared/[token]/     the companions' view of a shared trip
      settings/           Settings pages, including Admin and two-factor
      admin/              curation: review queue, place editor, cities, backgrounds, trip reviews
      api/chat/           one streamed turn with Bento Man
      api/parse-booking/  a pasted confirmation, read with no tools
      api/cron/           the daily analytics-deletion retry
    components/           shared UI: plan sheet, mascot, seasonal backdrop, tour, logo
    copy/en.ts            every word the app shows
    lib/
      engine/             scoring, filters, scheduler, route assessor, re-timer (pure)
      transit/            graph, router, fares, seeds (pure)
      places/seed/        drafted place records, one file per city
      bento-man/          prompt, tools, proposals, stores, the chat loop, evaluation
      vault/              gap detector, encryption, redaction, booking reader
      trips/              sharing expiry, shared plan, reviews, guided start
      guards/             spend cap, rate limits, sign-in limits
      security/           content security policy, bearer checks
      supabase/           server and service-role clients, cookie options
      analytics/          consent-gated analytics and address scrubbing
      account/            names and account deletion
    proxy.ts              session refresh and route protection
  scripts/                command-line tools ([commands](commands.md))
  supabase/
    migrations/           the schema, in order (the source of truth for tables)
    seed*.sql             reference data and generated seeds
```

The repo root also holds `docs/` (this vault), `design/` (mock-ups), `tools/docs-check/` and the campaign CLI.
