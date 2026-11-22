import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildFontCss, FONTS, parseFaces, readFontsource, SYSTEM_SYMBOLS, type Face } from "./font-css";

// A Windows checkout may turn the file's line endings into CRLF.
const committed = readFileSync(fileURLToPath(new URL("../../app/fonts.css", import.meta.url)), "utf8").replace(/\r\n/g, "\n");
const built = parseFaces(committed);
const covers = (face: Face, cp: number) => face.ranges.some(([a, b]) => cp >= a && cp <= b);
const isJapanese = (face: Face) => /-\d+-\d+-normal\.woff2$/.test(face.file);
const cp = (c: string) => c.codePointAt(0)!;

describe("fonts.css", () => {
  it("is current: run `npm run fonts` after changing font-css.ts or a fontsource package", () => {
    expect(committed).toBe(buildFontCss(readFontsource));
  });

  it("serves woff2 only, from files that exist", () => {
    expect(committed).not.toMatch(/\.woff\)/);
    for (const face of built) {
      const path = fileURLToPath(new URL(`../../../node_modules/@fontsource/${face.pkg}/files/${face.file}`, import.meta.url));
      expect(existsSync(path), face.file).toBe(true);
    }
  });

  // Each weight keeps every face fontsource gives it, in fontsource's order
  // (the browser checks overlapping ranges last-declared first, so the order
  // decides which file a shared character such as a space comes from).
  it.each(FONTS.flatMap(({ pkg, weights }) => weights.map((w) => [pkg, w] as const)))(
    "%s %i keeps fontsource's faces and order, less the system symbols",
    (pkg, weight) => {
      const source = parseFaces(readFontsource(pkg, weight)).map((f) =>
        isJapanese(f) ? { ...f, ranges: f.ranges.flatMap((r) => minus(r, SYSTEM_SYMBOLS)) } : f,
      ).filter((f) => f.ranges.length > 0);
      const ours = built.filter((f) => f.pkg === pkg && f.weight === weight);
      expect(ours.map((f) => [f.file, f.family, f.ranges])).toEqual(source.map((f) => [f.file, f.family, f.ranges]));
    },
  );

  it("draws Japanese in every Zen weight, and never sends an arrow or a dash to a Japanese file", () => {
    for (const { pkg, weights } of FONTS.filter((f) => f.pkg.startsWith("zen-"))) {
      for (const w of weights) {
        const faces = built.filter((f) => f.pkg === pkg && f.weight === w);
        for (const c of ["弁", "当", "伏", "見", "稲", "荷", "お", "か", "え", "り", "ナ"]) {
          expect(faces.some((f) => isJapanese(f) && covers(f, cp(c))), `${pkg} ${w} ${c}`).toBe(true);
        }
        for (const c of ["←", "→", "↗", "✓"]) {
          expect(faces.filter((f) => isJapanese(f) && covers(f, cp(c))), `${pkg} ${w} ${c}`).toEqual([]);
        }
        // "—" is in a Japanese range too, but the Latin face is declared
        // after it, so the Latin file wins.
        const dash = faces.filter((f) => covers(f, cp("—")));
        expect(dash.at(-1)?.file, `${pkg} ${w}`).toMatch(/-latin-\d+-normal\.woff2$/);
      }
    }
  });
});

function minus([a, b]: [number, number], cut: readonly (readonly [number, number])[]): [number, number][] {
  let parts: [number, number][] = [[a, b]];
  for (const [x, y] of cut) {
    parts = parts.flatMap(([p, q]): [number, number][] =>
      y < p || x > q ? [[p, q]] : [...(p < x ? [[p, x - 1] as [number, number]] : []), ...(q > y ? [[y + 1, q] as [number, number]] : [])],
    );
  }
  return parts;
}
