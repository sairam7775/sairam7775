import { coat, eyes, feet, hand, lacquerHead, map, question, sleeve, sparkle, umeboshi } from "./parts";
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

/** A blink at the end of a loop that ends at `end`. */
const blink = (part: string, end: number): Track => ({
  part,
  prop: "scale",
  keys: [[0, [100, 100]], [end - 13, [100, 100]], [end - 8, [100, 10]], [end - 3, [100, 100]], [end, [100, 100]]],
});

/** Eyes ^ ^, the box bouncing, the umeboshi popping, two twinkles; then the
 *  open eyes come back and he rests. */
const headHappy: Figure = {
  key: "head-happy",
  form: "head",
  parts: [...headParts([...eyes("head", "happy"), ...eyes("head", "dots", 0)]), sparkle("spark1", [66, -2]), sparkle("spark2", [-2, 8])],
  intro: 48,
  idle: 126,
  tracks: [
    { part: "head", prop: "position", keys: [[0, [0, 0]], [10, [0, -6]], [18, [0, 0]]] },
    { part: "head", prop: "scale", keys: [[0, [100, 100]], [10, [98, 103]], [18, [106, 93]], [23, [100, 100]]] },
    { part: "umeboshi", prop: "scale", keys: [[0, [100, 100]], [14, [100, 100]], [18, [130, 130]], [24, [100, 100]]] },
    { part: "umeboshi", prop: "position", keys: [[0, [0, 0]], [48, [0, 0]], [111, [0, -1.6]], [174, [0, 0]]] },
    { part: "spark1", prop: "scale", keys: [[0, [0, 0]], [14, [100, 100]], [29, [100, 100]], [48, [0, 0]]] },
    { part: "spark1", prop: "opacity", keys: [[0, 0], [14, 100], [29, 100], [48, 0]] },
    { part: "spark2", prop: "scale", keys: [[0, [0, 0]], [10, [0, 0]], [24, [100, 100]], [38, [100, 100]], [48, [0, 0]]] },
    { part: "spark2", prop: "opacity", keys: [[0, 0], [10, 0], [24, 100], [38, 100], [48, 0]] },
    { part: "eyesHappy", prop: "opacity", keys: [[0, 100], [48, 0]], hold: true },
    { part: "eyes", prop: "opacity", keys: [[0, 0], [48, 100]], hold: true },
    blink("eyes", 174),
  ],
};

/** A wink while the box rocks and the umeboshi pops up like a raised hand. */
const headHello: Figure = {
  key: "head-hello",
  form: "head",
  parts: headParts(eyes("head", "wink")),
  intro: 72,
  idle: 126,
  tracks: [
    { part: "head", prop: "rotation", keys: [[0, 0], [11, -7], [23, 6], [35, -4], [45, 2], [54, 0]] },
    { part: "umeboshi", prop: "position", keys: [[0, [0, 0]], [10, [0, -15]], [20, [0, -12]], [35, [0, -12]], [45, [0, -15]], [58, [0, 0]]] },
    { part: "winkR", prop: "opacity", keys: [[0, 100], [72, 0]], hold: true },
    { part: "eyeR", prop: "opacity", keys: [[0, 0], [72, 100]], hold: true },
    blink("eyes", 198),
  ],
};

/** The whole guide: everything hangs from `body`, which sways about his feet. */
const guide = (parts: Part[]): Part[] => [{ id: "body", pivot: [48, 118], shapes: [] }, ...parts];

/** He waves with his left hand, map in the right, and winks; then lowers
 *  the arm, and sways and blinks. */
const fullHello: Figure = {
  key: "full-hello",
  form: "full",
  parts: guide([
    sleeve("armL", "M32 67L18 52", "body", [32, 67]),
    hand("handL", 16, 50, [3, 2], "armL"),
    sleeve("armR", "M64 67L73 82", "body"),
    feet("body"),
    coat("body"),
    map("map", [68, 76], "body"),
    hand("handR", 73, 84, [-3, -3], "body"),
    { ...lacquerHead("head", [16, 0]), parent: "body" },
    umeboshi("head"),
    ...eyes("head", "wink"),
  ]),
  intro: 90,
  idle: 120,
  tracks: [
    { part: "armL", prop: "rotation", keys: [[0, 0], [9, -12], [20, 14], [31, -12], [42, 14], [58, 0], [72, 0], [90, -112]] },
    { part: "winkR", prop: "opacity", keys: [[0, 100], [72, 0]], hold: true },
    { part: "eyeR", prop: "opacity", keys: [[0, 0], [72, 100]], hold: true },
    blink("eyes", 210),
    { part: "body", prop: "rotation", keys: [[0, 0], [90, 0], [120, 1.2], [180, -1.2], [210, 0]] },
  ],
};

/** Map held up, scratching his head, which tilts as his eyes search left
 *  and right under a "?"; then the "?" fades and he blinks. */
const fullLost: Figure = {
  key: "full-lost",
  form: "full",
  parts: [
    ...guide([
      sleeve("armR", "M64 67L75 59", "body"),
      feet("body"),
      coat("body"),
      { ...lacquerHead("head", [16, 0]), parent: "body" },
      umeboshi("head"),
      ...eyes("head", "dots"),
      map("map", [68, 41], "body"),
      hand("handR", 76, 57, [-3, -3], "body"),
      sleeve("armL", "M32 67L17 58L20 47", "body", [32, 67]),
      hand("handL", 20, 45, [3, 1], "armL"),
    ]),
    question("question", [86, 0]),
  ],
  intro: 96,
  idle: 126,
  tracks: [
    { part: "head", prop: "rotation", keys: [[0, 0], [8, 0], [17, -4], [38, -4], [50, 4], [71, 4], [83, 0]] },
    { part: "eyes", prop: "position", keys: [[0, [0, 0]], [8, [0, 0]], [17, [-2.2, 0]], [38, [-2.2, 0]], [50, [2.2, 0]], [71, [2.2, 0]], [83, [0, 0]]] },
    { part: "armL", prop: "rotation", keys: [[0, 0], [10, 5], [19, -2], [29, 5], [38, -2], [48, 5], [58, -2], [67, 0]] },
    { part: "question", prop: "opacity", keys: [[0, 100], [77, 100], [88, 0]] },
    { part: "question", prop: "position", keys: [[0, [0, 0]], [24, [0, -1.5]], [48, [0, 0]], [72, [0, -1.5]], [88, [0, -2]]] },
    blink("eyes", 222),
  ],
};

export const FIGURES: Record<FigureKey, Figure> = {
  "head-rest": headRest,
  "head-think": headThink,
  "head-happy": headHappy,
  "head-hello": headHello,
  "full-hello": fullHello,
  "full-lost": fullLost,
};

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
