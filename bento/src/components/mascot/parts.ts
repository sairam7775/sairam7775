import type { Part, Shape } from "./types";

/** The pieces Bento Man is built from. Coordinates come from the approved
 *  drawings in `docs/superpowers/specs/2026-10-19-bento-man/`; the head is
 *  drawn in its own 64 × 64 box and placed with `at`. */

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
