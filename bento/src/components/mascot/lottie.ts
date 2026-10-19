import { CANVAS, drawOrder, FIGURES, figureOf } from "./moods";
import { toContours } from "./path";
import { ROLE_COLOR, type Figure, type FigureKey, type Part, type Prop, type Role, type Shape, type Track, type Value } from "./types";

/** Figure → Lottie JSON, for the light SVG player. Each part is a null layer
 *  carrying its placement and motion; its shapes are shape layers parented
 *  to it, one per run of the same colour role, classed `bm-f-<role>` or
 *  `bm-s-<role>` so globals.css can recolour them. Opacity is set on the
 *  shape layers, because Lottie doesn't pass a parent's opacity down. */

/** Figures that move, and so get a file in public/mascot/. */
export const FILES: FigureKey[] = (Object.keys(FIGURES) as FigureKey[]).filter((k) => {
  const f = FIGURES[k]!;
  return f.intro + f.idle > 0;
});

type Json = Record<string, unknown>;

const r3 = (n: number) => Math.round(n * 1000) / 1000;
const still = (k: unknown): Json => ({ a: 0, k });
const IN = { x: [0.58], y: [1] };
const OUT = { x: [0.42], y: [0] };

function color(role: Role): number[] {
  const hex = ROLE_COLOR[role].slice(1);
  return [0, 2, 4].map((i) => r3(parseInt(hex.slice(i, i + 2), 16) / 255)).concat(1);
}

/** A property: static, or keyframed with ease-in-out (or holds). */
function animated(keys: [number, number[]][], hold?: boolean): Json {
  if (keys.length === 1) return still(keys[0][1]);
  return {
    a: 1,
    k: keys.map(([t, s], i) => (i === keys.length - 1 ? { t, s } : hold ? { t, s, h: 1 } : { t, s, i: IN, o: OUT })),
  };
}

const vec = (v: Value): [number, number] => (typeof v === "number" ? [v, v] : v);

function transform(p: Part, f: Figure, offset: [number, number]): Json {
  const track = (prop: Prop): Track | undefined => f.tracks.find((t) => t.part === p.id && t.prop === prop);
  const scale = p.scale ?? 1;
  const [px, py] = p.pivot ?? [0, 0];
  const [ax, ay] = p.at ?? [0, 0];
  const base: [number, number] = [offset[0] + ax + scale * px, offset[1] + ay + scale * py];

  const pos = track("position");
  const rot = track("rotation");
  const sc = track("scale");
  const restScale = p.restScale ?? 100;
  return {
    a: still([r3(px), r3(py), 0]),
    p: pos
      ? animated(pos.keys.map(([t, v]) => [t, [r3(base[0] + vec(v)[0]), r3(base[1] + vec(v)[1]), 0]]), pos.hold)
      : still([r3(base[0]), r3(base[1]), 0]),
    s: sc
      ? animated(sc.keys.map(([t, v]) => [t, [r3(scale * vec(v)[0]), r3(scale * vec(v)[1]), 100]]), sc.hold)
      : still([r3(scale * restScale), r3(scale * restScale), 100]),
    r: rot ? animated(rot.keys.map(([t, v]) => [t, [v as number]]), rot.hold) : still(0),
    o: still(100),
  };
}

function shapeItem(s: Shape): Json[] {
  if (s.kind === "rect") return [{ ty: "rc", d: 1, p: still([r3(s.x + s.w / 2), r3(s.y + s.h / 2)]), s: still([s.w, s.h]), r: still(s.r) }];
  if (s.kind === "ellipse") return [{ ty: "el", d: 1, p: still([s.cx, s.cy]), s: still([r3(2 * s.rx), r3(2 * s.ry)]) }];
  return toContours(s.d).map((c) => ({
    ty: "sh",
    d: 1,
    ks: still({ c: c.c, v: c.v.map(([x, y]) => [r3(x), r3(y)]), i: c.i.map(([x, y]) => [r3(x), r3(y)]), o: c.o.map(([x, y]) => [r3(x), r3(y)]) }),
  }));
}

function paintItem(s: Shape, kind: "fl" | "st"): Json {
  const o = still(s.opacity ?? 100);
  if (kind === "fl") return { ty: "fl", c: still(color(s.fill!)), o, r: 1 };
  return {
    ty: "st",
    c: still(color(s.stroke!)),
    o,
    w: still(s.width ?? 1),
    lc: s.cap === "round" ? 2 : 1,
    lj: s.join === "round" ? 2 : 1,
    ml: 4,
    ...(s.dash ? { d: [{ n: "d", nm: "dash", v: still(s.dash[0]) }, { n: "g", nm: "gap", v: still(s.dash[1]) }, { n: "o", nm: "offset", v: still(0) }] } : {}),
  };
}

const GROUP_TR = { ty: "tr", p: still([0, 0]), a: still([0, 0]), s: still([100, 100]), r: still(0), o: still(100), sk: still(0), sa: still(0) };

/** A part's shapes as runs of one paint each, in drawing order. */
function runs(p: Part): { cl: string; groups: Json[] }[] {
  const out: { cl: string; groups: Json[] }[] = [];
  for (const s of p.shapes)
    for (const kind of ["fl", "st"] as const) {
      const role = kind === "fl" ? s.fill : s.stroke;
      if (!role) continue;
      const cl = `bm-${kind === "fl" ? "f" : "s"}-${role}`;
      const group = { ty: "gr", it: [...shapeItem(s), paintItem(s, kind), GROUP_TR] };
      const last = out.at(-1);
      if (last && last.cl === cl) last.groups.push(group);
      else out.push({ cl, groups: [group] });
    }
  return out;
}

export function buildLottie(key: FigureKey): object {
  const f = figureOf(key);
  const c = CANVAS[f.form];
  const op = f.intro + f.idle;
  const common = { ddd: 0, sr: 1, ao: 0, ip: 0, op, st: 0, bm: 0 };

  // Bottom to top first; Lottie wants the top layer first.
  type Layer = { part: Part; kind: "null" } | { part: Part; kind: "shapes"; cl: string; groups: Json[] };
  const layers: Layer[] = [];
  for (const p of drawOrder(f)) {
    layers.push({ part: p, kind: "null" });
    for (const r of runs(p)) layers.push({ part: p, kind: "shapes", ...r });
  }
  layers.reverse();
  const nullInd = new Map(layers.flatMap((l, i) => (l.kind === "null" ? [[l.part.id, i + 1] as const] : [])));

  const json = layers.map((l, i) => {
    const ind = i + 1;
    if (l.kind === "null") {
      const parent = l.part.parent ? nullInd.get(l.part.parent) : undefined;
      return { ...common, ind, ty: 3, nm: l.part.id, ks: transform(l.part, f, l.part.parent ? [0, 0] : c.offset), ...(parent ? { parent } : {}) };
    }
    const opacity = f.tracks.find((t) => t.part === l.part.id && t.prop === "opacity");
    return {
      ...common,
      ind,
      ty: 4,
      nm: `${l.part.id} ${l.cl}`,
      cl: l.cl,
      parent: nullInd.get(l.part.id),
      ks: {
        a: still([0, 0, 0]),
        p: still([0, 0, 0]),
        s: still([100, 100, 100]),
        r: still(0),
        o: opacity ? animated(opacity.keys.map(([t, v]) => [t, [v as number]]), opacity.hold) : still(l.part.opacity ?? 100),
      },
      // Within a layer, too, Lottie draws the first shape on top.
      shapes: [...l.groups].reverse(),
    };
  });

  return {
    v: "5.7.4",
    fr: 30,
    ip: 0,
    op,
    w: c.w,
    h: c.h,
    nm: key,
    ddd: 0,
    assets: [],
    layers: json,
    markers: [
      { tm: 0, cm: "intro", dr: f.intro },
      { tm: f.intro, cm: "idle", dr: f.idle },
    ],
  };
}
