import type { Part, Shape } from "./types";

/** The pieces Bento Man is built from. Coordinates come from the approved
 *  drawings in `docs/superpowers/specs/2026-10-19-bento-man/`; the head is
 *  drawn in its own 64 × 64 box and placed with `at`, the body in the full
 *  figure's 96 × 132 box. */

const TILES: [number, number][] = [[7, 7], [34.5, 7], [7, 34.5], [34.5, 34.5]];

/** The lacquer box: dark rim, a thin highlight, four white compartments.
 *  It turns and squashes about the middle of its bottom edge. */
export function lacquerHead(id: string, at?: [number, number]): Part {
  return {
    id,
    at,
    pivot: [32, 60],
    shapes: [
      { kind: "rect", x: 1, y: 1, w: 62, h: 62, r: 18, fill: "rim" },
      { kind: "rect", x: 3.4, y: 3.4, w: 57.2, h: 57.2, r: 15.6, stroke: "sheen", width: 0.9 },
      ...TILES.map(([x, y]): Shape => ({ kind: "rect", x, y, w: 22.5, h: 22.5, r: 6, fill: "tile" })),
    ],
  };
}

/** The umeboshi in the top-left compartment. */
export function umeboshi(parent: string): Part {
  return { id: "umeboshi", parent, pivot: [18, 18], shapes: [{ kind: "ellipse", cx: 18, cy: 18, rx: 7, ry: 7, fill: "ume" }] };
}

const dot = (cx: number): Shape => ({ kind: "ellipse", cx, cy: 43, rx: 3.6, ry: 3.6, fill: "face" });
const arc = (d: string): Shape => ({ kind: "path", d, stroke: "face", width: 3.2, cap: "round" });

/** Trousers, white socks with their straps, and sandals. */
export function feet(parent: string): Part {
  const leg = (x: number): Shape => ({ kind: "rect", x, y: 98, w: 9, h: 10, r: 1.5, fill: "pants", stroke: "line", width: 1.5 });
  const sock = (x: number): Shape => ({ kind: "rect", x, y: 106, w: 10, h: 9, r: 3.5, fill: "white", stroke: "line", width: 1.5 });
  const sole = (x: number): Shape => ({ kind: "rect", x, y: 114, w: 15, h: 4, r: 2, fill: "paper", stroke: "line", width: 1.5 });
  return {
    id: "feet",
    parent,
    shapes: [
      leg(36),
      leg(51),
      sock(35.5),
      sock(50.5),
      { kind: "path", d: "M37.5 110.5l3 2l3 -2M52.5 110.5l3 2l3 -2", stroke: "line", width: 1.5, cap: "round", join: "round" },
      sole(33),
      sole(48),
    ],
  };
}

/** The indigo happi coat: collar band, belt and its bow. */
export function coat(parent: string): Part {
  const collar = "M41 62.5L48 80L55 62.5";
  const tails = "M47 87.5l-3 6M49 87.5l3 6";
  const loop = (cx: number): Shape => ({ kind: "ellipse", cx, cy: 86, rx: 3.6, ry: 2.4, fill: "belt", stroke: "line", width: 1.3 });
  return {
    id: "coat",
    parent,
    shapes: [
      { kind: "path", d: "M36 62h24q6 0 7.5 6l3.5 28q.5 4 -3.5 4h-39q-4 0 -3.5 -4l3.5 -28q1.5 -6 7.5 -6z", fill: "coat", stroke: "line", width: 2, join: "round" },
      { kind: "path", d: collar, stroke: "line", width: 6.5, join: "round" },
      { kind: "path", d: collar, stroke: "white", width: 3.8, join: "round" },
      { kind: "path", d: "M26.5 83H69.5L70.1 89H25.9Z", fill: "belt", stroke: "line", width: 1.5, join: "round" },
      { kind: "path", d: tails, stroke: "line", width: 3.6, cap: "round" },
      { kind: "path", d: tails, stroke: "belt", width: 1.8, cap: "round" },
      loop(44),
      loop(52),
      { kind: "ellipse", cx: 48, cy: 86, rx: 2.1, ry: 2.1, fill: "belt", stroke: "line", width: 1.3 },
    ],
  };
}

/** A wide sleeve along `d`: an outlined thick stroke. `pivot` is the shoulder. */
export function sleeve(id: string, d: string, parent: string, pivot?: [number, number]): Part {
  return {
    id,
    parent,
    pivot,
    shapes: [
      { kind: "path", d, stroke: "line", width: 12.5, cap: "round", join: "round" },
      { kind: "path", d, stroke: "coat", width: 9, cap: "round", join: "round" },
    ],
  };
}

/** A mitten hand at (x, y); the thumb sits at `thumb` from its centre. */
export function hand(id: string, x: number, y: number, thumb: [number, number], parent: string): Part {
  return {
    id,
    parent,
    shapes: [
      { kind: "ellipse", cx: x + thumb[0], cy: y + thumb[1], rx: 2, ry: 2, fill: "skin", stroke: "line", width: 1.4 },
      { kind: "ellipse", cx: x, cy: y, rx: 4.6, ry: 4.6, fill: "skin", stroke: "line", width: 1.8 },
    ],
  };
}

/** The folded map he carries, with a dotted route. Its lines stay ink in
 *  both themes: it's paper. */
export function map(id: string, at: [number, number], parent: string, scale?: number): Part {
  return {
    id,
    parent,
    at,
    scale,
    shapes: [
      { kind: "path", d: "M0 2l8 -2l8 2l8 -2v15l-8 2l-8 -2l-8 2z", fill: "paper", stroke: "face", width: 1.6, join: "round" },
      { kind: "path", d: "M8 0v15M16 2v15", stroke: "face", width: 1 },
      { kind: "path", d: "M3.5 13q4 -6 8.5 -3.5t8 -5.5", stroke: "ume", width: 1.3, cap: "round", dash: [1.6, 1.4] },
      { kind: "ellipse", cx: 20.5, cy: 4, rx: 1.5, ry: 1.5, fill: "ume" },
    ],
  };
}

/** A twinkle, hidden at rest (opacity 0, scale 0). */
export function sparkle(id: string, at: [number, number]): Part {
  return {
    id,
    at,
    pivot: [0, 0],
    opacity: 0,
    restScale: 0,
    shapes: [{ kind: "path", d: "M0 -3.5L1 -1L3.5 0L1 1L0 3.5L-1 1L-3.5 0L-1 -1Z", fill: "spark" }],
  };
}

/** The "?" over his head when he's lost. */
export function question(id: string, at: [number, number]): Part {
  return {
    id,
    at,
    shapes: [
      { kind: "path", d: "M-2.8 -3.6q0 -3.6 3 -3.6q3 0 3 2.9q0 1.9 -2 2.8q-1 .5 -1 1.7v.7", stroke: "muted", width: 2.2, cap: "round", join: "round" },
      { kind: "ellipse", cx: 0.2, cy: 4.3, rx: 1.3, ry: 1.3, fill: "muted" },
    ],
  };
}

/** The eyes in the lower compartments. `dots` and `wink` give a part called
 *  `eyes` that blinks about (32, 43); `wink` splits it into `eyeL`, `eyeR`
 *  (hidden at rest) and `winkR`. `opacity` is the top part's rest opacity. */
export function eyes(parent: string, kind: "dots" | "happy" | "wink", opacity = 100): Part[] {
  const o = opacity === 100 ? {} : { opacity };
  if (kind === "happy") return [{ id: "eyesHappy", parent, ...o, shapes: [arc("M16 45q4 -6 8 0M40 45q4 -6 8 0")] }];
  if (kind === "dots") return [{ id: "eyes", parent, pivot: [32, 43], ...o, shapes: [dot(20), dot(44)] }];
  return [
    { id: "eyes", parent, pivot: [32, 43], ...o, shapes: [] },
    { id: "eyeL", parent: "eyes", shapes: [dot(20)] },
    { id: "eyeR", parent: "eyes", opacity: 0, shapes: [dot(44)] },
    { id: "winkR", parent: "eyes", shapes: [arc("M40 44q4 -5 8 0")] },
  ];
}
