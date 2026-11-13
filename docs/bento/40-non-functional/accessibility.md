---
type: non-functional
status: draft
implementation: partial
code:
  - bento/src/components/mascot/
  - bento/src/components/seasonal/
  - bento/src/app/globals.css
last_reviewed: 2026-11-13
---

# Accessibility

## Target

| # | Requirement |
|---|---|
| A1 | **Motion stops for anyone who asks:** under reduced motion, every animation is off (tiles, bars, the seasonal scene, the figure) |
| A2 | **Motion that starts by itself stops within five seconds, or can be paused** (WCAG 2.2.2) |
| A3 | **Decoration is hidden from assistive technology** (`aria-hidden`), and what it goes with is in text |
| A4 | **Text contrast** stays readable over the seasonal scene (the veil keeps it unchanged) |
| A5 | **No accessibility claim about a place** (such as "step-free") until it's verified for that place; until then the field is absent, not guessed |
| A6 | A target WCAG level for the whole app: **not set yet** |

## How it's checked

- A1 and A2 for the figure: tests check every intro's length and that rest poses are still (`bento/src/components/mascot/`, `playback.test.ts`, `moods.test.ts`).
- Manual checks with reduced motion on.
- An automated audit (axe) has been run on some pages; it isn't part of every change yet.

## Evidence

- Bento Man's figure rests after its intro, with under five seconds of motion ([Bento Man's figure](../20-design/bento-man-figure.md)).
- `globals.css`: the motion classes are off under `prefers-reduced-motion`.

## Known gaps

- **The seasonal backdrop** keeps moving for anyone without reduced motion turned on, which goes against A2 ([seasonal backdrop](../20-design/seasonal-backdrop.md)).
- An axe finding on the chat list (`scrollable-region-focusable`) is open.
- No target WCAG level, and no screen-reader walkthrough on record.
