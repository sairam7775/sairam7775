import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildLottie, FILES } from "./lottie";
import { CANVAS, figureOf } from "./moods";

type Layer = { ty: number; cl?: string; ind: number; parent?: number };
type Lottie = { v: string; fr: number; w: number; h: number; op: number; layers: Layer[]; markers: { cm: string; tm: number; dr: number }[] };

const committed = (key: string) => readFileSync(fileURLToPath(new URL(`../../../public/mascot/${key}.json`, import.meta.url)), "utf8");
const ROLE = /^bm-[fs]-(line|rim|sheen|coat|belt|pants|muted|tile|face|ume|white|skin|paper|spark)$/;

describe("Bento Man's Lottie files", () => {
  it("covers exactly the figures a screen animates", () => {
    expect([...FILES].sort()).toEqual(["full-hello", "full-lost", "head-happy", "head-hello", "head-think"]);
  });

  for (const key of FILES) {
    it(`${key} is up to date (run npm run mascot)`, () => {
      expect(committed(key)).toBe(JSON.stringify(buildLottie(key)));
    });

    it(`${key} is a sound Lottie file`, () => {
      const j = buildLottie(key) as Lottie;
      const { w, h } = CANVAS[figureOf(key).form];
      expect([j.v, j.fr, j.w, j.h]).toEqual(["5.7.4", 30, w, h]);
      expect(j.markers.map((m) => m.cm)).toEqual(["intro", "idle"]);
      expect(j.markers[0].tm).toBe(0);
      expect(j.markers[1].tm).toBe(j.markers[0].dr);
      expect(j.op).toBe(j.markers[1].tm + j.markers[1].dr);
      expect(JSON.stringify(j).length).toBeLessThan(25_000);
    });

    it(`${key} classes every fill and stroke by its colour role`, () => {
      const j = buildLottie(key) as { layers: { shapes?: { it: { ty: string; cl?: string }[] }[] }[] };
      const paints = j.layers.flatMap((l) => l.shapes ?? []).flatMap((g) => g.it).filter((i) => i.ty === "fl" || i.ty === "st");
      expect(paints.length).toBeGreaterThan(0);
      for (const p of paints) expect(p.cl).toMatch(ROLE);
    });

    it(`${key} parents every layer to a layer that exists`, () => {
      const j = buildLottie(key) as Lottie;
      const nulls = new Set(j.layers.filter((l) => l.ty === 3).map((l) => l.ind));
      for (const l of j.layers) if (l.parent !== undefined) expect(nulls).toContain(l.parent);
      expect(j.layers.map((l) => l.ind)).toEqual(j.layers.map((_, i) => i + 1));
    });
  }
});
