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

/** Search state is (station, line and mode arrived on), so a change of line
 *  can be charged as a transfer, and a leg ends where `assemble` ends one: at
 *  a new line or a new mode. Walking never pays the penalty: the walk is the
 *  transfer. `rode` says whether a train has been ridden yet, so the next
 *  ride after a walk can be counted as a change of train. */
interface State {
  station: string;
  line: string;
  mode: string;
  rode: boolean;
}

// Station ids are slugs, line names use middle dots and modes are single
// words, so " @ " cannot occur inside any part. After a ride `rode` is
// always true, so only walk-only states carry the marker.
const key = (s: State) => `${s.station} @ ${s.line} @ ${s.mode}${s.rode ? "" : " @ -"}`;

/** What the search minimises, in order: minutes as the traveller sees them
 *  (rides, walks and the change penalty: exactly `Route.minutes`), then
 *  changes of train (`Route.transfers`), then legs. Only exact ties on
 *  minutes reach the second and third, so no route gets slower. The last,
 *  `sig`, settles routes tied on all three the same way whatever order the
 *  edges come in: each edge adds its line, mode and arrival station, and
 *  the smaller string wins. Edge tokens are joined with a separator that
 *  sorts below every character in them, so comparing two signatures
 *  compares their edges one by one, and adding an edge never makes a
 *  signature smaller. That keeps the search order consistent. */
interface Cost {
  min: number;
  changes: number;
  legs: number;
  sig: string;
}

const ZERO: Cost = { min: 0, changes: 0, legs: 0, sig: "" };

const SEP = "\u0001";
const edgeToken = (e: Edge) => `${e.line}\u0002${e.mode}\u0002${e.to}`;

function less(a: Cost, b: Cost): boolean {
  if (a.min !== b.min) return a.min < b.min;
  if (a.changes !== b.changes) return a.changes < b.changes;
  if (a.legs !== b.legs) return a.legs < b.legs;
  return a.sig < b.sig;
}

class MinHeap {
  private a: { c: Cost; s: State }[] = [];
  push(c: Cost, s: State) {
    this.a.push({ c, s });
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(this.a[i].c, this.a[p].c)) break;
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
        if (l < this.a.length && less(this.a[l].c, this.a[m].c)) m = l;
        if (r < this.a.length && less(this.a[r].c, this.a[m].c)) m = r;
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
  const dist = new Map<string, Cost>();
  const prev = new Map<string, { state: State; edge: Edge }>();
  const heap = new MinHeap();

  const start: State = { station: fromId, line: "", mode: "", rode: false };
  dist.set(key(start), ZERO);
  heap.push(ZERO, start);

  let best: State | null = null;

  while (heap.size) {
    const { c, s } = heap.pop();
    const known = dist.get(key(s));
    if (known && less(known, c)) continue;
    if (s.station === toId) {
      best = s;
      break;
    }
    for (const e of g.out.get(s.station) ?? []) {
      const isTransfer = s.line !== "" && s.line !== e.line && e.mode !== "walk" && s.line !== "walk";
      // The rules `assemble` uses: a new line or a new mode starts a new
      // leg, and a new train after an earlier one is a change, even across
      // a walk.
      const newLeg = s.line !== e.line || s.mode !== e.mode;
      const newTrain = newLeg && e.mode !== "walk";
      const nc: Cost = {
        min: c.min + e.minutes + (isTransfer ? penalty : 0),
        changes: c.changes + (newTrain && s.rode ? 1 : 0),
        legs: c.legs + (newLeg ? 1 : 0),
        sig: c.sig === "" ? edgeToken(e) : c.sig + SEP + edgeToken(e),
      };
      const ns: State = { station: e.to, line: e.line, mode: e.mode, rode: s.rode || e.mode !== "walk" };
      const nk = key(ns);
      const old = dist.get(nk);
      if (!old || less(nc, old)) {
        dist.set(nk, nc);
        prev.set(nk, { state: s, edge: e });
        heap.push(nc, ns);
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

  return assemble(g, from, to, path, dist.get(key(best))!.min);
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
  // fare is exact and stands alone. A walk ends a run, unless it carries the
  // run's operator: a designated transfer between two of that operator's
  // stations, charged as one journey.
  let fareJpy = 0;
  let allExact = true;
  let unpricedRides = 0;
  let run: { operator: string; km: number; kmKnown: boolean; leg: number } | null = null;

  const closeRun = () => {
    if (!run) return;
    allExact = false;
    // An operator with no fare table, or a run with no distance, has no
    // price Bento can stand behind. Count it rather than charge ¥0: a ride
    // must never read as free because the data is missing.
    const fare = run.kmKnown ? bandFare(run.operator, run.km) : null;
    if (fare == null) unpricedRides++;
    else {
      legs[run.leg].fareJpy += fare; // attributed to the run's first leg
      fareJpy += fare;
    }
    run = null;
  };

  path.forEach((e, i) => {
    const leg = legIndexOfEdge[i];
    if (e.mode === "walk") {
      if (run && e.operator != null && e.operator === run.operator) return;
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
    if (!run) run = { operator, km: 0, kmKnown: true, leg };
    if (e.km == null) run.kmKnown = false;
    else run.km += e.km;
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
    unpricedRides,
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
