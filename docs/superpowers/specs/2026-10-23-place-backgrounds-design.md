# Place backgrounds: Bento learns each place's lasting story

Agreed with the owner on 23 Oct 2026. The aim is to lean on AI models less by
keeping Bento's own checked knowledge of Japan.

## What changes for a traveller

- When a traveller asks Bento Man about a place's history, meaning or what it
  is known for, Bento Man first looks for Bento's **checked background** for that
  place. If there is one, it retells that and adds nothing.
- If there is none yet, Bento Man may give two or three sentences of widely
  known background from the model's general knowledge, saying it is general
  background. This is the one exception to the honesty rule ("never state a
  fact you were not handed"). It never covers hours, prices, times, closures,
  crowds or anything else a traveller acts on.
- Each such ask is counted, so the most-asked places get written first.
- On the trip page, a stop with a checked background has an "About this place"
  disclosure showing it, with no AI call at all.

## Lasting facts vs facts that change

A background holds only what does not change: when and why the place was built,
what happened to it, and what it is known for. It is 120–900 characters. It must
not contain a clock time or a price, and both the drafter and the admin form
reject one. Hours, prices, booking and closures stay in the place record, where
they already are. A scheduled re-check of those is a separate, later plan.

## How a background is made

1. **Asked.** `note_background_ask` adds one to the count for (place, day). It
   stores no user id and no message text, so nothing personal is kept.
2. **Drafted.** The owner runs `scripts/draft-backgrounds.ts`. It picks the
   most-asked places with no checked background (or the places named on the
   command line). It asks Gemini to write in Bento's own words from the place's
   official pages, read with `url_context` (never Google Maps). A draft whose
   pages could not be read is skipped, not saved. Each place is one request on
   the free tier the live site shares, so it drafts 5 places by default. It is a
   dry run unless `--write` is given, and it never overwrites a checked
   background.
3. **Checked.** `/admin/backgrounds` lists the most-asked places and the drafts.
   The owner edits a draft, or writes one from scratch, and approves it. Saving
   a checked background sends it back to draft, like editing a place.
4. **Used.** Only checked backgrounds of verified places reach travellers,
   through the `place_backgrounds_public` view.

## Decisions

- One background per place, not per topic. Etiquette and similar topics can
  come later if travellers ask for them.
- Bento's own wording only. Wikipedia text is CC BY-SA and is not copied.
- Drafting runs by hand, not on a cron, because it spends the Gemini free-tier
  quota the live site uses.
- The prompt rule and the new tool change Bento Man's cached prefix. The
  affected eval scenarios must pass on the live model, and the owner is asked
  before that run.

## Not in this plan

- Re-checking hours and prices on a schedule (a separate plan, after
  migrations 0025 and 0026 are live).
- Showing backgrounds on the printed and shared plan.
- Tokyo places such as Sensō-ji. They follow once the Tokyo places and their
  stations are in. Kansai places come first.
