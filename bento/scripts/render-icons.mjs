/**
 * Renders every raster the app needs from the SVG masters, via Chromium.
 *
 *   node scripts/render-icons.mjs
 *
 * Sizes follow platform rules, not taste: iOS wants an opaque 180px square
 * and applies its own corner mask; PWA "any" icons may keep transparency;
 * maskable icons must be full-bleed with the mark inside the central 80%
 * safe zone; favicons need a filled mark, because thin lines vanish at 16px.
 */
// Local playwright if the project has it, else the machine's global install.
const { chromium } = await import("playwright").catch(() =>
  import("/opt/node22/lib/node_modules/playwright/index.mjs"),
);
import { readFileSync, writeFileSync } from "node:fs";

const LACQUER = "#221C1E", RICE = "#FBF8F3", SALMON = "#FF7757";

// The mark on a background, with padding as a fraction of the side.
function icon({ size, bg, pad, radius, line }) {
  const inner = size * (1 - 2 * pad);
  const off = size * pad;
  const s = inner / 64;
  return `<!doctype html><body style="margin:0;background:transparent">
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg ? `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>` : ""}
  <g transform="translate(${off} ${off}) scale(${s})" fill="none">
    <rect x="4" y="4" width="56" height="56" rx="16" stroke="${line}" stroke-width="6"/>
    <path d="M32 4v56M4 32h56" stroke="${line}" stroke-width="6"/>
    <circle cx="18" cy="18" r="7.5" fill="${SALMON}"/>
  </g>
</svg></body>`;
}

const lockup = readFileSync("public/logo/bento-lockup.svg", "utf8");

// Embed the faces the card uses. Google Fonts isn't reachable from every
// build machine, and a social card with a fallback font ships forever.
const face = (family, file, weight) =>
  `@font-face{font-family:'${family}';font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(file).toString("base64")}) format('woff2')}`;
const fonts = `<style>
${face("Bricolage Grotesque", "node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-500-normal.woff2", 500)}
${face("DM Mono", "node_modules/@fontsource/dm-mono/files/dm-mono-latin-500-normal.woff2", 500)}
</style>`;
const ogPage = `<!doctype html><body style="margin:0">${fonts}
<div style="width:1200px;height:630px;background:${RICE};display:flex;flex-direction:column;justify-content:space-between;padding:72px 84px;box-sizing:border-box;font-family:'Bricolage Grotesque',system-ui,sans-serif;">
  <div style="width:520px">${lockup.replace('width="', 'style="width:100%;height:auto" width="')}</div>
  <div>
    <div style="font-size:40px;line-height:1.2;color:#4A4145;max-width:22ch;font-weight:500">A trip planner for people who have never been to Japan.</div>
    <div style="margin-top:28px;display:flex;gap:12px">
      ${["Real travel times", "Honest expectations", "Tells you what's missing"].map(t =>
        `<span style="font-family:'DM Mono',ui-monospace,monospace;font-size:19px;background:${LACQUER};color:${RICE};padding:12px 20px;border-radius:999px">${t}</span>`).join("")}
    </div>
  </div>
</div></body>`;

const jobs = [
  // favicon sources — filled, tighter padding, so the box reads at 16px
  ...[16, 32, 48].map(size => ["public/icons/favicon-" + size + ".png",
    icon({ size, bg: LACQUER, pad: 0.10, radius: size * 0.22, line: RICE }), size, size]),
  // browser / PWA "any": rounded lacquer tile, transparent corners
  ...[192, 512].map(size => ["public/icons/icon-" + size + ".png",
    icon({ size, bg: LACQUER, pad: 0.17, radius: size * 0.22, line: RICE }), size, size]),
  // maskable: full-bleed, mark within the central 80%
  ...[192, 512].map(size => ["public/icons/maskable-" + size + ".png",
    icon({ size, bg: LACQUER, pad: 0.24, radius: 0, line: RICE }), size, size]),
  // iOS: opaque, square — iOS rounds it
  ["src/app/apple-icon.png", icon({ size: 180, bg: LACQUER, pad: 0.17, radius: 0, line: RICE }), 180, 180],
  // social card
  ["src/app/opengraph-image.png", ogPage, 1200, 630],
];

const browser = await chromium.launch();
for (const [out, html, w, h] of jobs) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.waitForTimeout(150);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  writeFileSync(out, png);
  console.log(`${out}  ${w}×${h}  ${(png.length / 1024).toFixed(1)} KB`);
  await page.close();
}
await browser.close();
