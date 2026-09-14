import { bandFare } from "./fares";
import type { Edge, Route, RouteLeg, RouteOptions, Station } from "./types";

export interface Graph {
  stations: Map<string, Station>;
  /** Outgoing edges by station id. */
  out: Map<string, Edge[]>;
}

export function buildGraph(stations: Station[], edges: Edge[]): Graph {
  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const out = new Map<string, Edge[]>();
  for (const e of edges) {
    if (!stationMap.has(e.from) || !stationMap.has(e.to)) {
      throw new Error(`edge ${e.from} -> ${e.to} references an unknown station`);
    }
    let list = out.get(e.from);
    if (!list) {
      list = [];
      out.set(e.from, list);
    }
    list.push(e);
  }
  return { stations: stationMap, out };
}

/** Both directions of a hop, for seeds and importers. */
export function bothWays(e: Edge): Edge[] {
  return [e, { ...e, from: e.to, to: e.from }];
}

// ---------------------------------------------------------------- Dijkstra

/** Search state is (station, line arrived on), so a change of line can be
 *  charged as a transfer. Walking never pays the penalty: the walk is the
 *  transfer. */
interface State {
  station: string;
  line: string;
}

// Station ids are slugs and line names use middle dots, so " @ " cannot
// occur inside either half.
const key = (s: State) => `${s.station} @ ${s.line}`;

class MinHeap {
  private a: { d: number; s: State }[] = [];
  push(d: number, s: State) {
    this.a.push({ d, s });
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].d <= this.a[i].d) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop()!;
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < this.a.length && this.a[l].d < this.a[m].d) m = l;
        if (r < this.a.length && this.a[r].d < this.a[m].d) m = r;
        if (m === i) break;
        [this.a[m], this.a[i]] = [this.a[i], this.a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

export function route(g: Graph, fromId: string, toId: string, opts: RouteOptions = {}): Route | null {
  const from = g.stations.get(fromId);
  const to = g.stations.get(toId);
  if (!from || !to) return null;
  if (fromId === toId) {
    return { from, to, legs: [], minutes: 0, fareJpy: 0, fareKind: "exact", transfers: 0 };
  }

  const penalty = opts.transferPenaltyMin ?? 5;
  const dist = new Map<string, number>();
  const prev = new Map<string, { state: State; edge: Edge }>();
  const heap = new MinHeap();

  const start: State = { station: fromId, line: "" };
  dist.set(key(start), 0);
  heap.push(0, start);

  let best: State | null = null;

  while (heap.size) {
    const { d, s } = heap.pop();
    if (d > (dist.get(key(s)) ?? Infinity)) continue;
    if (s.station === toId) {
      best = s;
      break;
    }
    for (const e of g.out.get(s.station) ?? []) {
      const isTransfer = s.line !== "" && s.line !== e.line && e.mode !== "walk" && s.line !== "walk";
      const nd = d + e.minutes + (isTransfer ? penalty : 0);
      const ns: State = { station: e.to, line: e.line };
      const nk = key(ns);
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, { state: s, edge: e });
        heap.push(nd, ns);
      }
    }
  }

  if (!best) return null;

  // Walk the predecessor chain back to the start to recover the edges.
  const path: Edge[] = [];
  let cur: State = best;
  while (cur.line !== "") {
    const p = prev.get(key(cur))!;
    path.unshift(p.edge);
    cur = p.state;
  }

  return assemble(g, from, to, path, dist.get(key(best))!);
}

// ---------------------------------------------------------------- legs & fares

function assemble(g: Graph, from: Station, to: Station, path: Edge[], minutes: number): Route {
  // Consecutive edges on the same line are one leg: one train, one ticket.
  const legs: RouteLeg[] = [];
  const legIndexOfEdge: number[] = [];
  for (const e of path) {
    const last = legs[legs.length - 1];
    if (last && last.line === e.line && last.mode === e.mode) {
      last.to = g.stations.get(e.to)!;
      last.stops += e.stops ?? 1;
      last.minutes += e.minutes;
      if (e.note && !last.notes.includes(e.note)) last.notes.push(e.note);
    } else {
      legs.push({
        mode: e.mode,
        line: e.line,
        operator: e.operator ?? null,
        from: g.stations.get(e.from)!,
        to: g.stations.get(e.to)!,
        stops: e.stops ?? 1,
        minutes: e.minutes,
        fareJpy: 0,
        notes: e.note ? [e.note] : [],
      });
    }
    legIndexOfEdge.push(legs.length - 1);
  }

  // Fares. A run of consecutive edges on one operator is one ticket, so the
  // run's km are summed and the band looked up once — summing per-hop
  // minimums would double-charge a two-stop ride. An edge with an explicit
  // fare is exact and stands alone. A walk ends a run.
  let fareJpy = 0;
  let allExact = true;
  let run: { operator: string; km: number; leg: number } | null = null;

  const closeRun = () => {
    if (!run) return;
    const fare = bandFare(run.operator, run.km) ?? 0;
    legs[run.leg].fareJpy += fare; // attributed to the run's first leg
    fareJpy += fare;
    allExact = false;
    run = null;
  };

  path.forEach((e, i) => {
    const leg = legIndexOfEdge[i];
    if (e.mode === "walk") {
      closeRun();
      return;
    }
    if (e.fareJpy != null) {
      closeRun();
      legs[leg].fareJpy += e.fareJpy;
      fareJpy += e.fareJpy;
      return;
    }
    const operator = e.operator ?? "unknown";
    if (run && run.operator !== operator) closeRun();
    if (!run) run = { operator, km: 0, leg };
    run.km += e.km ?? 0;
  });
  closeRun();

  const ridden = legs.filter((l) => l.mode !== "walk").length;

  return {
    from,
    to,
    legs,
    minutes,
    fareJpy,
    fareKind: allExact ? "exact" : "estimate",
    transfers: Math.max(0, ridden - 1),
  };
}

/** Door to door between two places: walk to the station, ride, walk out. */
export function placeRoute(
  g: Graph,
  a: { stationId: string; walkMin: number },
  b: { stationId: string; walkMin: number },
  opts?: RouteOptions,
): Route | null {
  const r = route(g, a.stationId, b.stationId, opts);
  if (!r) return null;
  return { ...r, minutes: r.minutes + a.walkMin + b.walkMin };
}
