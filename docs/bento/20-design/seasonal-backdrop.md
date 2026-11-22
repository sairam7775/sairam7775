---
type: design
status: accepted
code:
  - bento/src/components/seasonal/
last_reviewed: 2026-11-22
---

# The seasonal backdrop

## Current

Behind every page sits a softly blurred Japanese scene for the season, with something drifting in front of it:

| Season (months) | Scene | Motion |
|---|---|---|
| Spring (March–May) | Cherry tree, Fuji, green hills | Petals falling, the tree sways |
| Summer (June–August) | Fuji at dusk, bamboo | Fireflies drift and blink, bamboo sways |
| Autumn (September–November) | Maple tree, a Kyoto pagoda on the hills | Maple leaves falling and spinning |
| Winter (December–February) | Snowy Alps, cedars, the Jigokudani hot spring with a snow monkey | Snowfall, steam, the monkey bobs and blinks |

Five more scenes show only when chosen, never by date:

| Scene | Drawing | Motion |
|---|---|---|
| Rainy season | Misty hills, hydrangea bushes, puddles | Soft rain, rings on the puddles |
| Mount Fuji | Fuji at dawn over a still lake | Light glints on the water, haze drifts |
| Night city | A lantern-lit street of wooden townhouses at dusk | Lanterns swing, warm glow drifts |
| Summer festival | Fireworks over stalls and paper lanterns | Fireworks open and fade, lanterns swing |
| Grand shrine | A path of vermilion torii up to the main hall | Cedars sway, sun motes drift |

**Which scene shows**, in order of priority:
1. A `?season=` preview in the address (a season or a scene, such as `?season=fuji`).
2. The traveller's choice in Settings → Appearance → Background (the `bento_season` cookie): a season or a scene.
3. On a trip page, the season of the trip's start date.
4. Today's season.

Automatic (no choice) only ever shows one of the four seasons.

## Rules

- A paper **veil** sits over the scene, densest over the centre column where the content is, so text contrast is unchanged.
- The far scene is blurred once (static); the near scene isn't filtered, because it moves. There's no `backdrop-filter`.
- The scenes use their own illustration palette (hex), the one exception to tokens-only colour.
- Every drawing is original: no shop names, signs, writing, logos or copies of a photo.
- Each scene must read in both themes. Skies stay light enough at the top for the logo's dark mark in the dark theme, and nothing bright sits behind the page's small grey text.
- Drawn in SVG and CSS, with no image downloads. Particle positions are deterministic, and phones get fewer particles.
- Decoration only: `aria-hidden`, can't be clicked, out of anything a traveller reads. Under reduced motion the scene is still and nothing falls.

## Open questions

- **Endless motion:** the particles keep moving for anyone who hasn't turned on reduced motion. WCAG 2.2.2 asks for a way to pause motion that lasts more than five seconds and starts by itself. Bento Man's figure was changed to stop after its intro; the backdrop hasn't been yet ([accessibility](../40-non-functional/accessibility.md)).

Rules in full: [bento/DESIGN.md](../../../bento/DESIGN.md), "Seasonal backdrop".
