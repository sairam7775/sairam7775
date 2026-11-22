/* Writes src/app/fonts.css from the fontsource packages: `npm run fonts`.
   See src/lib/fonts/font-css.ts. */
import { writeFileSync } from "node:fs";
import { buildFontCss, readFontsource } from "../src/lib/fonts/font-css";

const css = buildFontCss(readFontsource);
writeFileSync("src/app/fonts.css", css);
console.log(`src/app/fonts.css: ${(css.match(/@font-face/g) ?? []).length} faces, ${css.length} bytes`);
