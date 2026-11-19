import { describe, expect, it } from "vitest";
import { bothWays, buildGraph, route } from "../graph";
import type { Edge, Station } from "../types";

// route() against brute force: every path through small random graphs,
// scored by the rules the docs state. Window on:
// fewest window changes within T + slack, then minutes, changes, legs and
// signature. Window off: minutes, changes, legs, signature.

const PENALTY = 5;
const SLACK = 10;
const ids = ["s0", "s1", "s2", "s3", "s4"];
const stations: Station[] = ids.map((id) => ({ id, name: id, lines: [] }));

function rng(seed: number) {
  let s = seed;
  return (n: number) => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return Math.floor((s / 2147483648) * n);
  };
}

function randomEdges(seed: number): Edge[] {
  const r = rng(seed);
  const edges: Edge[] = [];
  for (const line of ["L0", "L1", "L2"]) {
    const order = [...ids].sort(() => 0).filter(() => r(3) > 0);
    // A simple path of 2–4 stations, in a shuffled order.
    for (let i = order.length - 1; i > 0; i--) {
      const j = r(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    const stops = order.slice(0, 2 + r(3));
    for (let i = 1; i < stops.length; i++) {
      edges.push(...bothWays({ from: stops[i - 1], to: stops[i], line, mode: r(4) ? "rail" : "bus", minutes: 3 + r(10) }));
    }
  }
  // At least 3 minutes, as every seed walk is: a walk there and back under
  // the 5-minute change penalty would let a route dodge a change by
  // revisiting a station, which the brute force (no station twice) skips.
  const a = r(5), b = (a + 1 + r(4)) % 5;
  edges.push(...bothWays({ from: ids[a], to: ids[b], line: "walk", mode: "walk", minutes: 3 + r(12) }));
  return edges;
}

interface Scored { min: number; wc: number; transfers: number; legs: number; sig: string; path: Edge[] }

/** Every path that visits no station twice. A route that came back to a
 *  station would pay a change or more minutes for nothing, so the best
 *  route is among these. */
function walks(edges: Edge[], from: string, to: string): Scored[] {
  const out = new Map<string, Edge[]>();
  for (const e of edges) out.set(e.from, [...(out.get(e.from) ?? []), e]);
  const found: Scored[] = [];
  const seen = new Set([from]);
  const go = (at: string, line: string, mode: string, rode: boolean, sc: Scored) => {
    if (at === to && sc.path.length) {
      found.push(sc);
      return;
    }
    for (const e of out.get(at) ?? []) {
      const transfer = line !== "" && line !== e.line && e.mode !== "walk" && line !== "walk";
      const min = sc.min + e.minutes + (transfer ? PENALTY : 0);
      if (seen.has(e.to)) continue;
      const newLeg = line !== e.line || mode !== e.mode;
      const newTrain = newLeg && e.mode !== "walk";
      seen.add(e.to);
      go(e.to, e.line, e.mode, rode || e.mode !== "walk", {
        min,
        wc: sc.wc + (newLeg && (e.mode === "walk" || (rode && line !== "walk")) ? 1 : 0),
        transfers: sc.transfers + (newTrain && rode ? 1 : 0),
        legs: sc.legs + (newLeg ? 1 : 0),
        sig: (sc.sig === "" ? "" : sc.sig + "\u0001") + `${e.line}\u0002${e.mode}\u0002${e.to}`,
        path: [...sc.path, e],
      });
      seen.delete(e.to);
    }
  };
  go(from, "", "", false, { min: 0, wc: 0, transfers: 0, legs: 0, sig: "", path: [] });
  return found;
}

const cmp = (keys: (keyof Scored)[]) => (a: Scored, b: Scored) => {
  for (const k of keys) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1;
  return 0;
};

/** Legs as `assemble` makes them: one per run of the same line and mode. */
function legsOf(path: Edge[]): string[] {
  const legs: { line: string; mode: string; to: string }[] = [];
  for (const e of path) {
    const last = legs[legs.length - 1];
    if (last && last.line === e.line && last.mode === e.mode) last.to = e.to;
    else legs.push({ line: e.line, mode: e.mode, to: e.to });
  }
  return legs.map((l) => `${l.line}/${l.mode}/${l.to}`);
}

function brute(edges: Edge[], from: string, to: string, slack: number): Scored | null {
  const all = walks(edges, from, to);
  if (!all.length) return null;
  const T = Math.min(...all.map((w) => w.min));
  const inWindow = all.filter((w) => w.min <= T + slack);
  const order = slack > 0 ? cmp(["wc", "min", "transfers", "legs", "sig"]) : cmp(["min", "transfers", "legs", "sig"]);
  return inWindow.sort(order)[0];
}

describe("route against brute force on small random graphs", () => {
  it.each([
    ["window on", SLACK],
    ["window off", 0],
  ])("%s", (_name, slack) => {
    let checked = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const edges = randomEdges(seed);
      const g = buildGraph(stations, edges);
      for (const a of ids) for (const b of ids) {
        if (a === b) continue;
        const want = brute(edges, a, b, slack);
        const got = route(g, a, b, { fewerChangesSlackMin: slack });
        if (!want) {
          expect(got, `seed ${seed} ${a}→${b}`).toBeNull();
          continue;
        }
        expect(got, `seed ${seed} ${a}→${b}`).not.toBeNull();
        expect(got!.legs.map((l) => `${l.line}/${l.mode}/${l.to.id}`), `seed ${seed} ${a}→${b}`).toEqual(legsOf(want.path));
        expect(got!.minutes, `seed ${seed} ${a}→${b}`).toBe(want.min);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(300);
  });
});
