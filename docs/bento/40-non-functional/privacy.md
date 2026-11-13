---
type: non-functional
status: accepted
implementation: shipped
code:
  - bento/src/lib/analytics/
  - bento/src/lib/account/
  - bento/src/lib/age-gate.ts
  - bento/src/copy/en.ts
last_reviewed: 2026-11-13
---

# Privacy

Bento is run from Japan and stores its data in Japan (Tokyo); Japan's Act on the Protection of Personal Information (APPI) applies. The words travellers read are the privacy, terms and cookies pages (`copy.privacy`, `copy.terms`, `copy.cookies`). **Those pages must stay true to the code**, and this note says how.

## Target

| # | Requirement |
|---|---|
| P1 | **Where data lives** is stated truthfully: account and trips in Japan (Tokyo), usage analytics (if allowed) in the EU |
| P2 | **Analytics only with consent, never content.** Analytics start only when the consent cookie says yes; "no" clears their storage. Bento sends names of events, counts, durations, ids, true/false values and copy keys, never chat text, booking titles or references, emails, names or birth dates. Autocapture keeps no element text; replays mask all text and inputs |
| P3 | **Account deletion removes everything of theirs:** every user table cascades. Spend records (`api_usage`) are kept but unlinked, because the spending cap sums them. Analytics data is deleted too when configured, retried daily up to ten times if it fails, and the person is told the truth about it |
| P4 | **16 and over:** every way to create an account passes the age screen; the birth date is never stored |
| P5 | **Stored booking references** are never shown in lists, logged or put in a model prompt. Pasted confirmations are redacted (labelled references, emails, phone and card numbers) before a model reads them, as a best effort; text typed into the chat isn't redacted |
| P6 | **Names** are optional, used only for greetings, and never sent to Bento Man, analytics or admin pages |
| P7 | **Shared links** start no analytics, send no referrer, and show nothing about the owner except their pace ([trip sharing](../10-product/trip-sharing.md)) |
| P8 | **Map links** send nothing to Google until the traveller opens one |
| P9 | **A new company that handles data** is named on the privacy page, and **anything newly collected** gets a line there |

## How it's checked

- Tests on the rules (see Evidence); the privacy copy is reviewed in every PR that collects something new (the Docs impact section).
- After a region move, the "where" wording is updated in the same change ([region move](../50-operations/supabase-region-move.md)).

## Evidence

- P2: `bento/src/lib/analytics/client.ts`, `consent.ts` and `url.test.ts` (addresses scrubbed).
- P3: `bento/src/lib/account/__tests__/` and `delete.test.ts`; migration 0029 for `api_usage`; the daily retry `api/cron/analytics-deletions`.
- P4: `bento/src/lib/age-gate.test.ts`; a test keeps the privacy page, the terms and the screen's age equal.
- P5: `bento/src/lib/vault/__tests__/redact.test.ts`, `crypto.test.ts`.
- P6: `bento/src/lib/account/name.test.ts`.
- P1: the privacy page's "where" section, updated for Tokyo in PR #65 (12 November 2026).

## Known gaps

- **Emails are sent through Gmail** (Google), and the privacy page doesn't name an email provider. The owner chose to keep the current wording for now (13 November 2026). Revisit when the email provider changes or before opening sign-ups widely.
- Free-tier Gemini prompts may be used by Google; production booking text must not go through it. The booking reader stays on Anthropic for that reason ([Bento Man (software)](../30-software/bento-man.md)).
- The operator's full name and address are given on request until the business is registered.

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Invariants" and "Legal pages".
