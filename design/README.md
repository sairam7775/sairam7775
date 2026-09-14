# Bento — screen designs

Six traveller-facing screens, drawn against the app's real design system
(`../bento/src/app/globals.css`) rather than an invented one.

| Artboard | Screen |
|---|---|
| `Onboarding.dc.html` | The seven questions, and where "nature but not hiking" becomes expressible |
| `Route.dc.html` | City route with the out-loud refusal and its arithmetic |
| `Main.dc.html` | Day view — compartment height proportional to time |
| `DayPhone.dc.html` | The ticket-gate view, offline, 390×844 |
| `Gaps.dc.html` | Coverage ribbon and the three severities |
| `Vault.dc.html` | Bookings, with the gap shown in line where it belongs |

Content is a nine-night Kansai–Sanyo trip scored against the owner profile
(§16 of the spec): standard pace, avoids crowds, shrines + history + scenery,
excludes beaches and hiking. Dates, hotels and flight routing are placeholder
specifics; travel times, fares and rules are real and match the spec.

## What this surfaced for P4

Drawing these turned up three things the engine has to do that the spec did
not say:

1. **The scheduler must return its rejects**, each with the term that killed
   it — "Arashiyama, other side of the city, 50 min each way" is more
   convincing than any included stop, because it proves the engine thought.
2. **Per-stop candidate rankings must be retained**, or "swap this" has
   nothing to offer. Cheap if kept from step 4, expensive to recompute.
3. **Cost totals are per city, not per trip** — follows from D14, but the
   engine's output shape had not carried it through.

Smaller: the gap detector needs to distinguish *never needed booking* from
*not booked yet*, and the phone view wants the next transit leg as a
first-class field rather than something derived at render time.

## Rebuilding

The published canvas is a seeded copy of the design-canvas payload; the
`.dc.html` files here are the source. To change a screen, edit its file and
re-seed — never edit the seeded output.
