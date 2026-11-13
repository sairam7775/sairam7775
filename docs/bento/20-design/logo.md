---
type: design
status: accepted
code:
  - bento/public/logo/
  - bento/src/components/logo.tsx
  - bento/scripts/render-icons.mjs
last_reviewed: 2026-11-13
---

# Logo

## Current

A bento box with four compartments and one umeboshi: a Hinomaru bento. The masters are SVG, and everything raster is rendered from them.

| File | Use |
|---|---|
| `public/logo/bento-mark.svg` | The mark: dark lines, transparent, for light backgrounds |
| `public/logo/bento-mark-light.svg` | Rice-white lines, for dark backgrounds |
| `public/logo/bento-app-icon.svg` | Filled lacquer tile: tabs, home screens, anywhere small |
| `public/logo/bento-wordmark.svg` | "Bento" in Bricolage Grotesque 800, outlined to paths |
| `public/logo/bento-lockup.svg`, `-light.svg` | Mark and wordmark, dark and light |
| `public/logo/bento-loader.svg`, `-light.svg` | The loader: the umeboshi hops between compartments |
| `src/components/logo.tsx` | `<BentoMark>` and `<BentoLogo>` in the app |
| `src/components/loading.tsx` | `<BentoLoader>` and `<PageLoader>`, used for route transitions |

The paths are relative to `bento/`.

Colours: lacquer `#221C1E`, rice `#FBF8F3`, salmon `#FF7757`.

## Rules

- **Platform files are generated, never hand-made:** `src/app/icon.svg`, `favicon.ico`, `apple-icon.png`, `opengraph-image.png`, and the installable-app icons in `public/icons/` (including maskable ones with the mark inside the central 80%).
- To change the logo, change the master SVG and re-render:

  ```bash
  node scripts/build-wordmark.mjs   # re-outline the wordmark from the font
  node scripts/render-icons.mjs     # re-render every PNG from the masters
  ```

Source: `bento/README.md` "Logo" (before 13 November 2026).
