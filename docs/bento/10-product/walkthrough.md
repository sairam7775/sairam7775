---
type: feature
status: accepted
implementation: shipped
code:
  - bento/src/components/tour/
last_reviewed: 2026-11-13
---

# The walkthrough (tours)

## Summary

Each page has a short tour that starts on the first visit and points at the parts that matter. It only points: it never changes data.

## Acceptance criteria

- One tour per page (`steps.ts`), started on the first visit.
- A step points at an element marked `data-tour="<name>"`, or shows as a centred card if that element isn't on the page.
- Seen tours are remembered in a cookie (`bento_tour`), read on the server so nothing flashes in.
- Settings → "Show the tour again" clears it, so each tour starts again. There's no Tour button in the header.
- The tour's words follow [Bento Man's voice](../20-design/voice.md).

## What it doesn't do

- Change data, or block the page.

## Code and tests

- `bento/src/components/tour/`. If an anchor named in a step is renamed or removed, update the step.
- Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Walkthrough".
