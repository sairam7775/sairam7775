import { preload } from "react-dom";
// Build assets (a turbopack rule in next.config.ts): each import is the
// URL the build serves the file at, the same URL fonts.css's face uses.
import kaku400 from "@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-latin-400-normal.woff2?url";
import maru900 from "@fontsource/zen-maru-gothic/files/zen-maru-gothic-latin-900-normal.woff2?url";
import kaku500 from "@fontsource/zen-kaku-gothic-new/files/zen-kaku-gothic-new-latin-500-normal.woff2?url";

/* The home hero's fonts, asked for in the HTML. Otherwise the browser finds
   them only while laying out the page, after the stylesheet has arrived, and
   on a slow phone they came after the first paint: the hero drew in the
   system font and moved when they swapped in, and that first layout ran
   slower too (performance.md, F11). Only the Latin files of what the first
   screen draws: the body (400, the hero paragraph), the heading (Maru 900)
   and the kicker, links and buttons (500). Japanese and other weights load
   as before, by unicode-range. A preload that is not used wastes the
   download, so this is for the home page only. */
const HERO_FONTS = [kaku400, maru900, kaku500];

export function preloadHeroFonts() {
  for (const href of HERO_FONTS) {
    // Fonts are always fetched in CORS mode; a preload without crossOrigin
    // would not be reused and the file would download twice.
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
}
