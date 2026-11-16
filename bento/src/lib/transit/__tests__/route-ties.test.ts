import { describe, expect, it } from "vitest";
import { bothWays, buildGraph, route } from "../graph";
import type { Edge, Station } from "../types";

const station = (id: string): Station => ({ id, name: id, lines: [] });
const ride = (from: string, to: string, line: string, minutes: number): Edge[] =>
  bothWays({ from, to, line, mode: "rail", operator: "test", km: 1, minutes });
const walk = (from: string, to: string, minutes: number): Edge[] =>
  bothWays({ from, to, line: "walk", mode: "walk", minutes });

const stations = ["a", "b", "c", "d", "h"].map(station);
const lines = (edges: Edge[], from = "a", to = "d") =>
  route(buildGraph(stations, edges), from, to)!.legs.map((l) => l.line);

// Three trains: 10 + (5 change) 5 + (5 change) 5 = 30 minutes, two changes.
// The edges come first, so the search meets this route first.
const threeTrains = (lastMin: number) => [
  ...ride("a", "b", "X", 10),
  ...ride("b", "c", "Y", 5),
  ...ride("c", "d", "Z", lastMin),
];
// One train, 1 + 29 = 30 minutes, no change.
const direct = [...ride("a", "h", "Direct", 1), ...ride("h", "d", "Direct", 29)];

/** Deterministic Fisher-Yates, so a failure can be replayed. */
function shuffled<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

describe("route — exact ties on minutes", () => {
  it("takes the direct train when a two-change route takes exactly as long", () => {
    const r = route(buildGraph(stations, [...threeTrains(5), ...direct]), "a", "d")!;
    expect(r.minutes).toBe(30);
    expect(r.legs.map((l) => l.line)).toEqual(["Direct"]);
    expect(r.transfers).toBe(0);
  });

  it("still takes a route with more changes when it is a minute faster", () => {
    const r = route(buildGraph(stations, [...threeTrains(4), ...direct]), "a", "d")!;
    expect(r.minutes).toBe(29);
    expect(r.legs.map((l) => l.line)).toEqual(["X", "Y", "Z"]);
    expect(r.transfers).toBe(2);
  });

  it("breaks a tie on changes by taking fewer legs", () => {
    // Walk 5 then ride 20, or one 25-minute ride: both no change, 25 min.
    const edges = [...walk("a", "b", 5), ...ride("b", "d", "L", 20), ...ride("a", "d", "M", 25)];
    const r = route(buildGraph(stations, edges), "a", "d")!;
    expect(r.minutes).toBe(25);
    expect(r.transfers).toBe(0);
    expect(r.legs.map((l) => l.line)).toEqual(["M"]);
  });

  it("gives the same answer whatever order the edges come in", () => {
    const tieOnMinutes = [...threeTrains(5), ...direct];
    const tieOnChanges = [...walk("a", "b", 5), ...ride("b", "d", "L", 20), ...ride("a", "d", "M", 25)];
    for (let seed = 1; seed <= 25; seed++) {
      expect(lines(shuffled(tieOnMinutes, seed)), `seed ${seed}`).toEqual(["Direct"]);
      expect(lines(shuffled(tieOnMinutes, seed), "d", "a"), `seed ${seed} back`).toEqual(["Direct"]);
      expect(lines(shuffled(tieOnChanges, seed)), `seed ${seed}`).toEqual(["M"]);
      expect(lines(shuffled(tieOnChanges, seed), "d", "a"), `seed ${seed} back`).toEqual(["M"]);
    }
  });

  it("counts a change of mode on one line name as a change, as the legs do", () => {
    // Rail L 1 + bus L 9 is two legs and one change; rail M 2 + 8 is one.
    const railThenBus: Edge[] = [
      ...ride("a", "b", "L", 1),
      ...bothWays({ from: "b", to: "d", line: "L", mode: "bus", operator: "test", km: 1, minutes: 9 }),
    ];
    const viaH = [...ride("a", "h", "M", 2), ...ride("h", "d", "M", 8)];
    for (let seed = 1; seed <= 25; seed++) {
      for (const [from, to] of [["a", "d"], ["d", "a"]]) {
        const r = route(buildGraph(stations, shuffled([...railThenBus, ...viaH], seed)), from, to)!;
        expect(r.minutes).toBe(10);
        expect(r.legs.map((l) => l.line), `seed ${seed} from ${from}`).toEqual(["M"]);
        expect(r.transfers).toBe(0);
      }
    }
    // Walk 2 then rail M 8 is two legs and no change, so it must also beat
    // the rail-then-bus route, which only looks like one leg by line name.
    const walkThenM = [...walk("a", "h", 2), ...ride("h", "d", "M", 8)];
    const r = route(buildGraph(stations, [...railThenBus, ...walkThenM]), "a", "d")!;
    expect(r.legs.map((l) => l.line)).toEqual(["walk", "M"]);
    expect(r.transfers).toBe(0);
  });
});
