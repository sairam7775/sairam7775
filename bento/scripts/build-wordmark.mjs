/**
 * Outlines the "Bento" wordmark from Bricolage Grotesque 800 so the lockup
 * is pure paths — no font dependency in the SVG, renders identically anywhere.
 */
import opentype from "opentype.js";
import { readFileSync, writeFileSync } from "node:fs";

const font = opentype.parse(
  readFileSync("node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff").buffer,
);

const SIZE = 100;
const TRACK = -0.02 * SIZE; // matches the UI's letter-spacing

// Lay the glyphs out by hand so tracking is applied between letters.
let x = 0;
const parts = [];
const bbox = { y2: 0 };
for (const ch of "Bento") {
  const g = font.charToGlyph(ch);
  const p = g.getPath(x, 0, SIZE);
  parts.push(p.toPathData(3));
  bbox.y2 = Math.max(bbox.y2 ?? 0, p.getBoundingBox().y2);
  x += (g.advanceWidth / font.unitsPerEm) * SIZE + TRACK;
}
const capHeight = (font.tables.os2?.sCapHeight ?? 700) / font.unitsPerEm * SIZE;
// Bounding box from the per-glyph paths — whole-string shaping trips on a
// GSUB lookup opentype.js doesn't implement, and we don't need ligatures.
const width = x - TRACK;

// Scale so the cap height equals the mark's inner box (56 of 64).
const s = 56 / capHeight;
const W = Math.ceil(width * s);
const H = 64;
const baseline = 4 + 56; // cap tops align with the mark's top edge (y=4)

const d = parts.join(" ");
const wordmark = (fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Bento">
  <g transform="translate(0 ${baseline}) scale(${s.toFixed(5)})"><path d="${d}" fill="${fill}"/></g>
</svg>
`;

const GAP = 18;
const lockup = (stroke, fill) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${64 + GAP + W} 64" width="${64 + GAP + W}" height="64" role="img" aria-label="Bento">
  <g fill="none">
    <rect x="4" y="4" width="56" height="56" rx="16" stroke="${stroke}" stroke-width="5"/>
    <path d="M32 4v56M4 32h56" stroke="${stroke}" stroke-width="5"/>
    <circle cx="18" cy="18" r="7" fill="#FF7757"/>
  </g>
  <g transform="translate(${64 + GAP} ${baseline}) scale(${s.toFixed(5)})"><path d="${d}" fill="${fill}"/></g>
</svg>
`;

writeFileSync("public/logo/bento-wordmark.svg", wordmark("#221C1E"));
writeFileSync("public/logo/bento-lockup.svg", lockup("#221C1E", "#221C1E"));
writeFileSync("public/logo/bento-lockup-light.svg", lockup("#FBF8F3", "#FBF8F3"));
console.log(`wordmark ${W}×${H}, cap height ${capHeight.toFixed(1)} → scale ${s.toFixed(3)}, descender to ${(bbox.y2 * s + baseline).toFixed(1)}`);
