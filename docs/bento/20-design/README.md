---
type: design
status: accepted
code:
  - bento/DESIGN.md
  - bento/src/app/globals.css
  - design/
last_reviewed: 2026-11-13
---

# Design

## Current

**Bento is drawn as a bento box.** Lacquer-dark frames hold compartment tiles in food colours on warm rice white. One accent, salmon, carries every primary action; umeboshi red is kept for what blocks a trip, and edamame green for what's fine. Shapes are soft (20px tiles, 30px boxes, pill buttons); motion is tiles settling into place, bars filling, and a hopping umeboshi while loading.

- **The design system** is [bento/DESIGN.md](../../../bento/DESIGN.md), kept next to the code: tokens, colours, typography, layout, elevation, components and motion. Read it before any interface work.
- **The source of truth for tokens** is `bento/src/app/globals.css`. If it and DESIGN.md disagree, `globals.css` wins; then fix DESIGN.md.
- **Type:** Zen Maru Gothic for headlines, Zen Kaku Gothic New for body text, DM Mono for data, all self-hosted (no fetch at build time). Japanese-made fonts, so a place name in kanji sits in the same voice as the English around it. The logo's wordmark is outlined Bricolage Grotesque (it's artwork).
- **Themes:** System, Light and Dark (Settings → Appearance). The dark values live twice in `globals.css`, under the media query and under `[data-theme="dark"]`: change one, change both.
- A Figma file mirrors the tokens (Foundations and Screens); `globals.css` wins if they disagree.

Related pages:
- [Bento Man's figure](bento-man-figure.md)
- [voice](voice.md)
- [the seasonal backdrop](seasonal-backdrop.md)
- [logo](logo.md)
- [inspiration](inspiration/README.md)

## Screens

The mock-ups are in `design/`, at the repo root.

| Mock-up | Shows | Status |
|---|---|---|
| `Main.dc.html` | Day view, compartment height proportional to time | **Current** in layout; fonts and some details superseded by DESIGN.md |
| `Route.dc.html` | City route with the out-loud refusal and its arithmetic | Current in idea |
| `Gaps.dc.html` | Coverage ribbon and the three severities | Current in idea |
| `Vault.dc.html` | Bookings, with the gap in line | Current in idea |
| `Onboarding.dc.html` | The seven questions | Exploratory |
| `DayPhone.dc.html` | The ticket-gate view on a phone, offline | **Exploratory:** there's no offline view yet ([open questions](../00-start/open-questions.md)) |
| `Loader.dc.html` | The loading animation | Current (built as the hopping umeboshi) |

"Current in idea" means that what's built follows the mock-up's structure, but the built screen, not the mock-up, is the reference.

## Rules that keep the design honest

- Use tokens (`text-ink-2`, `bg-surface`, `border-rule`), not raw colours. The exceptions are illustrations with their own palette: the logo, the seasonal scenes and Bento Man's figure.
- No `backdrop-filter` or `filter` on anything that animates, or sits over animation; it re-rasterises every frame. Blur only static layers.
- Never nest `@theme` inside `@media`: Tailwind v4 hoists it, and the dark values would apply in light mode too.
- All motion stops under reduced motion ([accessibility](../40-non-functional/accessibility.md)).

## Open questions

- From DESIGN.md's "Known Gaps"; see that section for the current list.
- The seasonal backdrop's endless motion and WCAG 2.2.2 ([seasonal backdrop](seasonal-backdrop.md)).

Agent rules: [bento/CLAUDE.md](../../../bento/CLAUDE.md), "Day view (P7)".
