import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseFaces } from "./font-css";

// The home page asks for its hero's font files in the HTML, before the
// stylesheet that names them arrives. A preload only helps if it fetches the
// very file a face in fonts.css points at: anything else is a second
// download. These tests read the source, since a .woff2 import is a build
// asset, not something a test can load.
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");
const source = read("./hero-preload.ts");
const faces = parseFaces(read("../../app/fonts.css").replace(/\r\n/g, "\n"));
const imports = [...source.matchAll(/from "@fontsource\/([^/]+)\/files\/([^"]+\.woff2)\?url"/g)].map(([, pkg, file]) => ({ pkg, file }));

describe("hero font preloads", () => {
  it("preloads a few files, not the whole set", () => {
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.length).toBeLessThanOrEqual(3);
  });

  it.each(imports.map((i) => [`${i.pkg}/${i.file}`, i] as const))("%s is a Latin face fonts.css uses", (_, { pkg, file }) => {
    expect(file).toMatch(/-latin-\d+-normal\.woff2$/);
    expect(faces.some((f) => f.pkg === pkg && f.file === file)).toBe(true);
  });

  // A face that still exists but that the hero no longer draws with would
  // pass the test above, so tie each preload to the hero's own text: the
  // heading (h1, Zen Maru Gothic, font-black), the kicker (font-medium,
  // Kaku 500) and the paragraph (body text, Kaku 400).
  it("preloads exactly the weights the hero draws with", () => {
    const hero = read("../../app/page.tsx").split("{/* Hero */}")[1].split("<DayPreview")[0];
    expect(hero).toMatch(/<h1 className="[^"]*\bfont-black\b/);
    expect(hero).toMatch(/<p className="[^"]*\bfont-medium\b/);
    expect(hero).toMatch(/<p className="mt-5 [^"]*text-ink-2">/);
    expect(imports.map((i) => i.file).sort()).toEqual([
      "zen-kaku-gothic-new-latin-400-normal.woff2",
      "zen-kaku-gothic-new-latin-500-normal.woff2",
      "zen-maru-gothic-latin-900-normal.woff2",
    ]);
  });

  it("asks for fonts the way the stylesheet will, so the browser reuses the download", () => {
    expect(source).toMatch(/as: "font"/);
    expect(source).toMatch(/type: "font\/woff2"/);
    expect(source).toMatch(/crossOrigin: "anonymous"/);
  });

  // A rule for every .woff2 also took over fonts.css's url()s, and the built
  // stylesheet then pointed the browser at node_modules paths.
  it("turns only `?url` font imports into URLs", async () => {
    const { default: config } = await import("../../../next.config");
    const rule = config.turbopack?.rules?.["*.woff2"];
    expect(rule).toMatchObject({ type: "asset", condition: { query: expect.any(RegExp) } });
    const { query } = (rule as { condition: { query: RegExp } }).condition;
    expect(query.test("?url")).toBe(true);
    expect(query.test("")).toBe(false);
  });

  it("the home page asks for them", () => {
    expect(read("../../app/page.tsx")).toMatch(/preloadHeroFonts\(\);/);
  });
});
