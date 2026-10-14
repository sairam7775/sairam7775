---
version: 1
name: Bento
description: A Japan trip planner drawn as a bento box. Lacquer-dark frames hold compartment tiles in food colours on warm rice white. One accent, salmon, carries every primary action; umeboshi red is reserved for what blocks a trip and edamame green for what is fine. Type is Japanese-made — Zen Maru Gothic's rounded headlines and Zen Kaku Gothic New's plain body — so a place name in kanji sits in the same voice as the English around it. Shapes are soft (20px tiles, 30px boxes, pill buttons); motion is tiles settling into place, bars filling and a hopping umeboshi for loading.

colors:
  # Light (default). Source of truth: bento/src/app/globals.css
  paper: "#fbf8f3"          # rice — the page
  surface: "#ffffff"        # a tile
  sunk: "#f3eee8"           # a tile's well, empty states, skeletons
  lacquer: "#221c1e"        # the box frame, user chat bubbles, date badge
  rice: "#fbf8f3"           # text on lacquer
  ink: "#221c1e"
  ink-2: "#4a4145"
  ink-3: "#8c8388"
  rule: "#eae3dc"
  accent: "#ff7757"         # salmon — primary actions only
  accent-deep: "#e85f3f"
  accent-soft: "#ffe9e2"
  ume: "#e5484d"            # blocking
  ume-soft: "#fbe2e3"
  edamame: "#3f9a60"        # fine / covered
  edamame-soft: "#e2f4e8"
  tamago: "#b07b00"         # tight / worth knowing
  tamago-bright: "#ffc94a"
  tamago-soft: "#fff3d1"
  lavender-soft: "#e4e7fb"

colors-dark:
  paper: "#171213"
  surface: "#221c1e"
  sunk: "#2a2325"
  lacquer: "#0f0c0d"
  rice: "#fbf8f3"
  ink: "#fbf8f3"
  ink-2: "#d5cdc9"
  ink-3: "#9a9095"
  rule: "#3a3235"
  accent: "#ff8a6e"
  accent-deep: "#ff7757"
  accent-soft: "#3a231d"
  ume: "#f26b6f"
  ume-soft: "#3a1f21"
  edamame: "#6fcb8e"
  edamame-soft: "#1e3327"
  tamago: "#ffd066"
  tamago-bright: "#ffc94a"
  tamago-soft: "#3a2f14"
  lavender-soft: "#262a3f"

typography:
  display-xl:   # trip title
    fontFamily: "'Zen Maru Gothic', 'Zen Kaku Gothic New', system-ui, sans-serif"
    fontSize: 48px
    fontWeight: 900
    lineHeight: 1
    letterSpacing: -0.01em
  display-lg:   # page titles ("Your trips", "What's still missing")
    fontFamily: "'Zen Maru Gothic', sans-serif"
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.15
  display-md:   # day heading, section heads
    fontFamily: "'Zen Maru Gothic', sans-serif"
    fontSize: 24px
    fontWeight: 700
  title:        # card and panel titles
    fontFamily: "'Zen Maru Gothic', sans-serif"
    fontSize: 16px
    fontWeight: 700
  body-md:
    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:        # form labels
    fontFamily: "'Zen Kaku Gothic New', sans-serif"
    fontSize: 13px
    fontWeight: 500
  data:         # times, dates, fares, durations
    fontFamily: "'DM Mono', ui-monospace, monospace"
    fontSize: 12px
    fontWeight: 400
  eyebrow:      # small uppercase tags ("DAY 3 · SUN", "BLOCKING")
    fontFamily: "'DM Mono', monospace"
    fontSize: 11px
    fontWeight: 400
    letterSpacing: 0.1em
    textTransform: uppercase

rounded:
  sm: 12px      # inputs
  tile: 20px    # compartments, cards, chat panel
  box: 30px     # the lacquer box
  full: 9999px  # buttons, chips, badges

spacing:
  base: 4px
  gap-tight: 8px
  gap: 16px
  gap-loose: 24px
  page-x: 16px / 24px / 40px   # phone / tablet / desktop
  max-width: 1680px            # trip page; lists and forms narrower (768–1152px)

elevation:
  tile: "0 1px 2px rgba(34,28,30,.04), 0 16px 36px -20px rgba(34,28,30,.25)"
  tile-dark: "0 1px 2px rgba(0,0,0,.3), 0 16px 36px -20px rgba(0,0,0,.6)"

components:
  button-primary:
    backgroundColor: "{colors.accent}"
    hoverBackground: "{colors.accent-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.full}"
    minHeight: 40px
    padding: 10px 20px
  button-secondary:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.rule}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    minHeight: 40px
  button-quiet:   # sign out, delete, remove
    backgroundColor: transparent
    hoverBackground: "{colors.sunk}"   # ume-soft for destructive
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    minHeight: 36px
  back-link:
    backgroundColor: "{colors.surface}"
    elevation: "{elevation.tile}"
    rounded: "{rounded.full}"
    minHeight: 40px
    label: "← <where it goes>"
  text-input:
    backgroundColor: "{colors.paper}"
    border: "1px solid {colors.rule}"
    rounded: "{rounded.sm}"
    minHeight: 44px
    typography: "{typography.body-md}"
  tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tile}"
    elevation: "{elevation.tile}"
  box:
    backgroundColor: "{colors.lacquer}"
    rounded: "{rounded.box}"
    padding: 12px
  day-chip:
    width: 115px
    rounded: "{rounded.tile}"
    active: "lacquer background, rice text"
  chat-bubble-user:
    backgroundColor: "{colors.lacquer}"
    textColor: "{colors.rice}"
    rounded: "20px 20px 6px 20px"
  chat-panel:
    rounded: "{rounded.tile}"
    height: "viewport − 136px on desktop (sticky); min(80dvh, 720px) on phone"
  proposal-card:
    backgroundColor: "{colors.paper}"
    border: "1px solid {colors.rule}"
    header: "{colors.sunk}"
  gap-ribbon:
    blocking: "{colors.ume-soft} background, one ume bar per uncovered night"
    fine: "{colors.surface}, edamame bars"
---

## Overview

Bento plans a first trip to Japan and tells the truth about it. The interface is a **bento box**: a lacquer-dark frame (`{colors.lacquer}`) holding compartments (`{components.tile}`) whose height is the time a stop takes. Over-packed days visibly spill past the line where the day's budget ends — the layout makes the problem legible before a word is read.

The page is warm rice white (`{colors.paper}`), never pure white; tiles are white (`{colors.surface}`) and float on a soft, low shadow. Food colours carry meaning and nothing else:

- **Salmon** (`{colors.accent}`) — the single accent. Primary buttons, links that move you forward, focus rings. If two things on screen are salmon, one of them is wrong.
- **Umeboshi** (`{colors.ume}`) — something blocks the trip: a night with no bed, an over-packed day.
- **Edamame** (`{colors.edamame}`) — covered, fine, accepted.
- **Tamago** (`{colors.tamago}`) — tight, or worth knowing.

**Key characteristics**
- Japanese-made type for an English interface: Zen Maru Gothic headlines (rounded, like station and shop signage), Zen Kaku Gothic New body, DM Mono for every number a traveller might act on — times, fares, dates.
- Soft geometry throughout: 20px tiles, 30px boxes, pill buttons and chips. No hard corners on anything you can touch.
- One elevation tier (`{elevation.tile}`). Depth comes from the lacquer frame, not stacked shadows.
- Proposals, never silent edits: anything Bento Man suggests arrives as a card with Accept / Reject.
- Light and dark follow the system. Dark mode is a palette swap on the same variables, not a separate design.

## Colors

Use the Tailwind tokens (`bg-paper`, `text-ink-2`, `border-rule`, `bg-accent`) — never raw hex in components. Each token has a dark value (`colors-dark`) applied under `prefers-color-scheme: dark` by overriding the CSS variables on `:root`.

> Implementation note: the dark palette must override variables on `:root` inside the media query. A nested `@theme` block inside `@media` is hoisted by Tailwind v4 and applies unconditionally — that bug once made the app permanently dark.

Text: `{colors.ink}` for headings and body, `{colors.ink-2}` for secondary copy, `{colors.ink-3}` for captions and metadata only (it is below body contrast — never use it for anything the traveller must read to act).

## Typography

| Role | Face | Size / weight |
|---|---|---|
| Trip title | Zen Maru Gothic | 40–48px / 900 |
| Page title | Zen Maru Gothic | 30px / 700 |
| Section / day | Zen Maru Gothic | 24px / 700 |
| Card title | Zen Maru Gothic | 16px / 700 |
| Body | Zen Kaku Gothic New | 15px / 400, line-height 1.6 |
| Secondary | Zen Kaku Gothic New | 14px / 400 |
| Label | Zen Kaku Gothic New | 13px / 500 |
| Data | DM Mono | 12px |
| Eyebrow tag | DM Mono | 11px uppercase, +0.1em |

**Principles**
- Headlines use the `.disp` class or `h1–h4`; they get `text-wrap: balance`.
- Minimum readable size is 12px. Anything a traveller taps or must read to decide is at least 13px.
- Uppercase mono is for short tags only (`DAY 3 · SUN`, `BLOCKING`). Never for sentences — a proposal summary is a sentence.
- Fonts are self-hosted with fontsource. Both Zen faces are split by unicode-range, so Japanese place names (伏見稲荷大社, 姫路城) render in the same family and only the glyph ranges used are downloaded.
- The **logo wordmark** is outlined from Bricolage Grotesque 800 (`public/logo/`, `scripts/build-wordmark.mjs`) and stays as drawn; it is artwork, not live text.

## Layout

- **Trip page:** two columns on desktop — the plan (fluid) and Bento Man (`minmax(380px, 34%)`). The chat is sticky and sized to the viewport so its input is always visible. On a phone the chat follows the plan, with an "Ask Bento Man ↓" jump link near the top.
- **Header:** one row — logo (→ your trips), back link, page badges, sign out.
- **Lists and forms:** a single readable column, 768–1152px.
- Spacing is a 4px grid; 16px between related blocks, 24px between sections.

## Elevation

One shadow (`{elevation.tile}`) for tiles and floating pills. The lacquer box has no shadow — it is the ground the tiles sit in. Hover lifts a tile 2px (`.lift`).

## Components

- **Buttons** — primary salmon pill; secondary white pill with a rule border; quiet text buttons for sign out / delete / remove (destructive ones turn ume on hover and **always confirm**). Minimum height 40px (36px for in-row quiet buttons).
- **Submit buttons** show a pending label ("Creating…", "Saving…", "Applying…") and disable while pending.
- **Inputs** — paper background, rule border, 12px radius, 44px tall. Date fields open the calendar on a click anywhere in the field; an end date can't precede its start.
- **Day chips** — horizontal strip, one per date; the active day is lacquer with rice text; a thin bar fills with the day's active time, ume when over budget.
- **The day box** — lacquer frame; compartments sized by duration; pin / ↑ / ↓ / remove on each stop.
- **Bento Man panel** — header (mark + name + "Nothing changes until you accept it"), scrolling conversation, input pinned to the bottom. User messages are lacquer bubbles; Bento Man's are plain text beside the mark. Empty state offers example prompts as chips.
- **Proposal card** — paper card with a sunk header ("**Proposal** · summary"), the route or days as they would be, change tags (new / moved / out), warnings in tamago, and Accept / Reject.
- **Gap ribbon** — one bar per night, solid edamame where covered, ume where not; the worst gap as a sentence; links to Bookings.

## Motion

- Tiles **rise** into place on load (`.up`, 620ms, staggered with `animation-delay`); bars **grow**; badges **pop**; rings fill.
- **Loading** is the Bento mark with the umeboshi hopping clockwise between compartments (`<BentoLoader>`), with a skeleton of the page's real shape on the trip page so nothing jumps when data arrives. In chat, the mini loader sits beside what Bento Man is doing ("Checking the route…").
- Everything stops under `prefers-reduced-motion`; the loader falls back to a gentle pulse.

## Seasonal backdrop

Behind every page sits a blurred Japanese scene for the season (`src/components/seasonal/`), with something drifting in front of it:

| Season (months) | Scene | Motion |
|---|---|---|
| Spring (Mar–May) | Cherry tree, Fuji, green hills | Petals falling, tree sways |
| Summer (Jun–Aug) | Fuji at dusk, bamboo | Fireflies drift and blink, bamboo sways |
| Autumn (Sep–Nov) | Maple tree, Kyoto pagoda on the hills | Momiji leaves falling and spinning |
| Winter (Dec–Feb) | Snowy Alps, cedars, the Jigokudani onsen with a snow monkey (Nagano) | Snowfall, onsen steam, the monkey bobs and blinks |

- The season is today's, except on a trip page, which shows the season of the trip's start date (`<UseSeason>`). `?season=winter` previews any season on any page.
- Layers: far scene blurred 10px (static, so it rasterises once), near scene unfiltered (it animates), then a **veil** of paper — densest over the centre column where content sits, lighter at the edges where the tree / onsen / bamboo are — then particles. Tiles are 90% surface, so the scene only tints them and text contrast is unchanged. No `backdrop-filter`: over a moving scene it re-blurs every frame.
- The scenes use their own illustration palette (hex), the one exception to tokens-only colour.
- Drawn in SVG and CSS — no image downloads. Particle positions are deterministic (`noise()`), so renders are stable; fewer particles on phones.
- Decoration only: `aria-hidden`, `pointer-events: none`, rendered after hydration with a fade-in. Under `prefers-reduced-motion` the scene is still and nothing falls.

## Voice

Bento Man is a local friend who knows the place and tells the truth. No enthusiasm as filler, no emoji in plan content, no confident prose where a fact is missing. Interface copy is plain sentences: "You have nowhere to sleep on the night of 26 November."

## Known Gaps

- Figma: [Bento — design system & screens](https://www.figma.com/design/GUjEmK5OqT6PAcRA9ucEll) — *Foundations* (colour variables, text styles, tile shadow, core components) and *Screens* (trip page desktop, phone, loading). The file is on a Starter plan, which allows one variable mode, so light and dark are `light/*` and `dark/*` variable groups rather than modes. It mirrors these tokens; `globals.css` remains the source of truth if they disagree.
- The admin (curation) pages still use the older header.
