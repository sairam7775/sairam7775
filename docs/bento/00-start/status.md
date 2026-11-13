---
type: overview
status: accepted
last_reviewed: 2026-11-13
---

# Status

The one place that says what's built, what's been checked, and what's open. Update it in the same PR as any change it describes.

## What a traveller can do today

| Area | What works | Note |
|---|---|---|
| Account | Sign up with email or Google (16+), sign in, two-factor for admins, Settings, delete the account | [Accounts and admins](../10-product/accounts-and-admins.md) |
| Planning with Bento Man | Onboarding questions, route proposals with the arithmetic, day plans and changes as proposals, date changes | [Bento Man](../10-product/bento-man.md), [proposals and diffs](../10-product/proposals-and-diffs.md) |
| The day view | The box for each day: drag, pin, remove, re-plan; train legs; map links | [Day view](../10-product/day-view.md) |
| The booking vault | Add or paste bookings, see gaps in plain sentences, plan bookings into days | [Booking vault](../10-product/booking-vault.md) |
| Sharing | A link for companions, with expiry choices | [Trip sharing](../10-product/trip-sharing.md) |
| After the trip | "How did the plan hold up?" | [Trip review](../10-product/trip-review.md) |
| Print or save | A plan sheet to print or save as a PDF | Part of [sharing](../10-product/trip-sharing.md) |
| Help | A short tour per page | [Walkthrough](../10-product/walkthrough.md) |

**Cities planned in depth:** Kyoto, Osaka, Nara, Hiroshima, Miyajima and Himeji (an en-route stop), plus Tokyo ([coverage](../10-product/coverage.md)). On 2026-11-11 the live database held 191 places, 323 stations and 1,008 train links; how many places are verified is shown in `/admin`.

## How it's built (all eight original phases shipped)

P1 foundation · P2 data spine · P3 transit · P4 the engine · P5 deep data · P6 Bento Man · P7 the itinerary interface · P8 the vault and gaps. The history is in the [progress history](../90-archive/progress-history.md).

## Since then (October–November 2026)

- Sharing, trip reviews, the regrouped Settings, admin two-factor, legal pages, consent-based analytics, account deletion.
- Bento Man's animated figure; the seasonal backdrop.
- Tokyo: places and a hand-built train network.
- **Security hardening** (PR #64, live 13 November 2026):
  - sign-in limits;
  - httpOnly cookies;
  - an enforced content security policy;
  - "Is this your account?" for email links;
  - database limits ([security](../40-non-functional/security.md)).
- **Moved to Tokyo** (12 November 2026): the database and the Vercel functions ([region move](../50-operations/supabase-region-move.md)).
- Google sign-in live (12 November 2026); emails sent through Gmail SMTP ([email](../50-operations/email-smtp.md)).

## Checked how

- Every PR: typecheck, lint, the unit tests and a production build (808 tests passing on 13 November 2026).
- Live checks after the Tokyo move and the security deploy (13 November 2026): email and password sign-in, Google sign-in, admin two-factor, password-reset email, the sign-in limiter recording attempts.
- **Not regularly checked:** the Bento Man evaluation against the live model (it uses the free daily quota; run subsets, with the owner's OK).

## Open

- [Open questions](open-questions.md): where the spec and the code disagree, and what's planned but not built (offline today view, JR Pass and luggage rules, and more).
- Delete the old Mumbai database project after about two weeks (around 27 November 2026), then its connection file.
- Apple sign-in: deferred ([mobile](../60-direction/mobile.md)).
- Google branding on the sign-in screen: needs Bento's own domain.
