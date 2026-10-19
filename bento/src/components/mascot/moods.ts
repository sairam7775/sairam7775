import { eyes, lacquerHead, umeboshi } from "./parts";
import type { Figure, FigureKey, Part, Track, Value } from "./types";

/** Every figure Bento Man appears as: the still pose is frame 0, `intro`
 *  plays once, `idle` loops. Timings are at 30 fps and come from the
 *  approved drawings. A figure with no frames is a still only. */

/** The drawing box of each form. `offset` moves the art inside it: the head
 *  is drawn in 0–64 and needs room above for a raised umeboshi. */
export const CANVAS = {
  head: { w: 76, h: 80, offset: [6, 10] as [number, number] },
  full: { w: 96, h: 132, offset: [0, 10] as [number, number] },
};

const headParts = (eyeParts: Part[]): Part[] => [lacquerHead("head"), umeboshi("head"), ...eyeParts];

const headRest: Figure = { key: "head-rest", form: "head", parts: headParts(eyes("head", "dots")), intro: 0, idle: 0, tracks: [] };

/** Eyes up, the umeboshi hopping to the empty compartment and back, twice
 *  per loop, with one blink. */
const headThink: Figure = {
  key: "head-think",
  form: "head",
  parts: headParts(eyes("head", "dots").map((p) => ({ ...p, at: [1.6, -1.8] }))),
  intro: 0,
  idle: 144,
  tracks: [
    {
      part: "umeboshi",
      prop: "position",
      keys: [
        [0, [0, 0]], [22, [0, 0]], [29, [14, -10]], [36, [28, 0]], [58, [28, 0]], [65, [14, -10]], [72, [0, 0]],
        [94, [0, 0]], [101, [14, -10]], [108, [28, 0]], [130, [28, 0]], [137, [14, -10]], [144, [0, 0]],
      ],
    },
    { part: "eyes", prop: "scale", keys: [[0, [100, 100]], [132, [100, 100]], [136, [100, 10]], [140, [100, 100]], [144, [100, 100]]] },
  ],
};

export const FIGURES = {
  "head-rest": headRest,
  "head-think": headThink,
} satisfies Partial<Record<FigureKey, Figure>> as Partial<Record<FigureKey, Figure>>;

/** Figures that move, and so get a file in public/mascot/. */
export const FILES: FigureKey[] = (Object.keys(FIGURES) as FigureKey[]).filter((k) => {
  const f = FIGURES[k]!;
  return f.intro + f.idle > 0;
});

/** The figure for a key; throws for one not drawn yet. */
export function figureOf(key: FigureKey): Figure {
  const f = FIGURES[key];
  if (!f) throw new Error(`Bento Man has no figure "${key}"`);
  return f;
}

/** Parts in drawing order: each part, then its children, depth first. */
export function drawOrder(f: Figure): Part[] {
  const out: Part[] = [];
  const visit = (parent: string | undefined) => {
    for (const p of f.parts)
      if (p.parent === parent) {
        out.push(p);
        visit(p.id);
      }
  };
  visit(undefined);
  return out;
}

/** A track's value at a frame: linear between keys, the first value before
 *  the first key, the last after the last; stepped when the track holds. */
export function valueAt(track: Track, frame: number): Value {
  const { keys } = track;
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1] = keys[i];
    if (frame < f1) {
      const [f0, v0] = keys[i - 1];
      if (track.hold) return v0;
      const t = (frame - f0) / (f1 - f0);
      const mix = (a: number, b: number) => a + (b - a) * t;
      return typeof v0 === "number" ? mix(v0, v1 as number) : [mix(v0[0], (v1 as [number, number])[0]), mix(v0[1], (v1 as [number, number])[1])];
    }
  }
  return keys[keys.length - 1][1];
}
