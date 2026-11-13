---
type: design
status: accepted
code:
  - bento/src/components/mascot/
  - bento/public/mascot/
last_reviewed: 2026-11-13
---

# Bento Man's figure

## Current

Bento Man appears as an animated figure: a lacquer bento box for a head, with eyes in its lower compartments and an umeboshi in the top left, on an indigo happi coat. It was chosen in October 2026 after several rounds, to help travellers feel connected to the guide. The visual rules are in [bento/DESIGN.md](../../../bento/DESIGN.md), "Bento Man, the figure".

## How it works

- **The art is data.** `parts.ts` and `moods.ts` (shapes, colour roles, pivots, keyframes) are the only source; `still.ts` draws a pose as SVG, and `lottie.ts` turns a figure into Lottie animation JSON.
- After changing the art, run `npm run mascot`. A test fails while `public/mascot/*.json` is stale; never edit those files by hand.
- Use `<BentoManFigure figure="…" size={…} />`. It shows the still first, then loads the light Lottie player only when he's on screen and motion is allowed.

## Rules

- **Motion that stops** (WCAG 2.2.2): after its intro, a figure rests on its first idle frame, with under five seconds of motion that starts by itself. A test checks every intro's length. Only the thinking head loops, while he works.
- Frame 0 of every figure is its still pose, and every loop is seamless (tested).
- He's decoration (`aria-hidden`); what he goes with is always in text.
- His colours that follow the theme are mapped to `--color-mascot-*` in `globals.css`; a test fails if the art uses a themed colour with no rule.
- The figure doesn't change his [voice](voice.md).

## Open questions

- The seasonal backdrop's endless motion raises the same WCAG 2.2.2 question ([accessibility](../40-non-functional/accessibility.md)).

Design history: `docs/superpowers/specs/2026-10-19-bento-man-character-design.md`. Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Bento Man's figure".
