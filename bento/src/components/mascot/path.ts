/** SVG path data → Lottie bezier contours. Lottie draws one contour per
 *  shape, with each vertex's in- and out-tangents relative to the vertex.
 *  Handles M L H V C S Q T Z (absolute and relative); the art uses no arcs. */

type Pt = [number, number];

export interface Contour {
  c: boolean;
  v: Pt[];
  i: Pt[];
  o: Pt[];
}

const TOKEN = /[MmLlHhVvCcSsQqTtZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g;
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, Z: 0 };

export function toContours(d: string): Contour[] {
  const tokens = d.match(TOKEN) ?? [];
  const contours: Contour[] = [];
  let cur: Contour | null = null;
  let pos: Pt = [0, 0];
  let start: Pt = [0, 0];
  // The last control point, for S and T reflections, and which kind it was.
  let lastCtrl: Pt | null = null;
  let lastKind: "C" | "Q" | null = null;
  let cmd = "";
  let k = 0;

  const num = () => Number(tokens[k++]);
  const lineTo = (p: Pt) => {
    cur!.v.push(p);
    cur!.i.push([0, 0]);
    cur!.o.push([0, 0]);
    pos = p;
  };
  const cubicTo = (c1: Pt, c2: Pt, p: Pt) => {
    const last = cur!.v.length - 1;
    cur!.o[last] = [c1[0] - pos[0], c1[1] - pos[1]];
    cur!.v.push(p);
    cur!.i.push([c2[0] - p[0], c2[1] - p[1]]);
    cur!.o.push([0, 0]);
    pos = p;
  };
  const close = () => {
    if (!cur) return;
    cur.c = true;
    const n = cur.v.length - 1;
    const [a, b] = [cur.v[0], cur.v[n]];
    if (n > 0 && Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) {
      // The closing vertex repeats the first: keep its in-tangent on the first.
      cur.i[0] = cur.i[n];
      cur.v.pop();
      cur.i.pop();
      cur.o.pop();
    }
    pos = start;
  };

  while (k < tokens.length) {
    if (/[A-Za-z]/.test(tokens[k])) cmd = tokens[k++];
    else if (!cmd) throw new Error(`path data must start with a command: ${d}`);
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    const at = (x: number, y: number): Pt => (rel ? [pos[0] + x, pos[1] + y] : [x, y]);

    if (up === "Z") {
      close();
      cur = null;
      lastCtrl = null;
      lastKind = null;
      // Z takes no numbers: anything after it must name its own command.
      cmd = "";
      continue;
    }
    if (k + ARITY[up] > tokens.length) throw new Error(`path data ends mid-command: ${d}`);

    if (up === "M") {
      const p = at(num(), num());
      cur = { c: false, v: [], i: [], o: [] };
      contours.push(cur);
      pos = p;
      start = p;
      lineTo(p);
      // Extra pairs after M are line-tos.
      cmd = rel ? "l" : "L";
      lastCtrl = null;
      lastKind = null;
      continue;
    }
    if (!cur) {
      // A drawing command after Z continues from the subpath's start.
      cur = { c: false, v: [], i: [], o: [] };
      contours.push(cur);
      lineTo(pos);
    }
    if (up === "L") {
      lineTo(at(num(), num()));
      lastKind = null;
    } else if (up === "H") {
      const x = num();
      lineTo([rel ? pos[0] + x : x, pos[1]]);
      lastKind = null;
    } else if (up === "V") {
      const y = num();
      lineTo([pos[0], rel ? pos[1] + y : y]);
      lastKind = null;
    } else if (up === "C" || up === "S") {
      const c1: Pt =
        up === "C"
          ? at(num(), num())
          : lastKind === "C" && lastCtrl
            ? [2 * pos[0] - lastCtrl[0], 2 * pos[1] - lastCtrl[1]]
            : pos;
      const c2 = at(num(), num());
      const p = at(num(), num());
      cubicTo(c1, c2, p);
      lastCtrl = c2;
      lastKind = "C";
    } else if (up === "Q" || up === "T") {
      const q: Pt =
        up === "Q"
          ? at(num(), num())
          : lastKind === "Q" && lastCtrl
            ? [2 * pos[0] - lastCtrl[0], 2 * pos[1] - lastCtrl[1]]
            : pos;
      const p = at(num(), num());
      const from = pos;
      cubicTo(
        [from[0] + (2 / 3) * (q[0] - from[0]), from[1] + (2 / 3) * (q[1] - from[1])],
        [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])],
        p,
      );
      lastCtrl = q;
      lastKind = "Q";
    }
  }
  return contours;
}
