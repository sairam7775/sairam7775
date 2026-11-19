import { describe, expect, it } from "vitest";
import { bothWays, buildGraph, FEWER_CHANGES_SLACK_MIN, route } from "../graph";
import type { Edge, Station } from "../types";

const station = (id: string): Station => ({ id, name: id, lines: [] });
const ride = (from: string, to: string, line: string, minutes: number): Edge[] =>
  bothWays({ from, to, line, mode: "rail", operator: "test", km: 1, minutes });
const walk = (from: string, to: string, minutes: number): Edge[] =>
  bothWays({ from, to, line: "walk", mode: "walk", minutes });

const stations = ["a", "b", "c", "d", "e", "h"].map(station);
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

  it("takes the direct train when the route with more changes is only a minute faster", () => {
    const r = route(buildGraph(stations, [...threeTrains(4), ...direct]), "a", "d")!;
    expect(r.minutes).toBe(30);
    expect(r.legs.map((l) => l.line)).toEqual(["Direct"]);
    expect(r.transfers).toBe(0);
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

  it("chooses between fully tied routes the same way whatever the edge order", () => {
    // Two direct trains, equal on minutes, changes and legs.
    const edges = [...ride("a", "d", "B", 10), ...ride("a", "d", "A", 10)];
    for (let seed = 1; seed <= 25; seed++) {
      expect(lines(shuffled(edges, seed)), `seed ${seed}`).toEqual(["A"]);
      expect(lines(shuffled(edges, seed), "d", "a"), `seed ${seed} back`).toEqual(["A"]);
    }
  });
});

describe("route — fewer changes within FEWER_CHANGES_SLACK_MIN of the fastest", () => {
  // One train from a to d taking `total` minutes, through h.
  const directOf = (total: number) => [...ride("a", "h", "Direct", 1), ...ride("h", "d", "Direct", total - 1)];
  // One change: a → e on P, change at e, e → d on Q. 10 + 5 + 10 = 25 minutes.
  const oneChange = [...ride("a", "e", "P", 10), ...ride("e", "d", "Q", 10)];

  it("is 20 minutes, in one named constant", () => {
    expect(FEWER_CHANGES_SLACK_MIN).toBe(20);
  });

  it("takes a direct train up to 20 minutes slower than the fastest route", () => {
    // threeTrains(5) is 30 minutes with two changes; the direct train is 50.
    const r = route(buildGraph(stations, [...threeTrains(5), ...directOf(30 + FEWER_CHANGES_SLACK_MIN)]), "a", "d")!;
    expect(r.legs.map((l) => l.line)).toEqual(["Direct"]);
    expect(r.minutes).toBe(50);
    expect(r.transfers).toBe(0);
  });

  it("takes the faster route when the direct train is more than 20 minutes slower", () => {
    const r = route(buildGraph(stations, [...threeTrains(5), ...directOf(30 + FEWER_CHANGES_SLACK_MIN + 1)]), "a", "d")!;
    expect(r.legs.map((l) => l.line)).toEqual(["X", "Y", "Z"]);
    expect(r.minutes).toBe(30);
    expect(r.transfers).toBe(2);
  });

  it("takes the fewest changes inside the window, then the fastest of those", () => {
    // Fastest: two changes, 30. One change: 15 + 5 + 20 = 40. Direct: 55,
    // past 30 + 20. The one-change route wins.
    const slowOneChange = [...ride("a", "e", "P", 15), ...ride("e", "d", "Q", 20)];
    const r = route(buildGraph(stations, [...threeTrains(5), ...slowOneChange, ...directOf(55)]), "a", "d")!;
    expect(r.legs.map((l) => l.line)).toEqual(["P", "Q"]);
    expect(r.minutes).toBe(40);
    expect(r.transfers).toBe(1);
  });

  it("among routes with the fewest changes, takes the fastest", () => {
    // Two direct trains inside the window: 45 and 48. The 45 wins.
    const edges = [...threeTrains(5), ...directOf(48), ...ride("a", "d", "Other", 45)];
    expect(lines(edges)).toEqual(["Other"]);
    expect(route(buildGraph(stations, edges), "a", "d")!.minutes).toBe(45);
  });

  it("can be turned off, for the fastest route whatever its changes", () => {
    // With the default the 40-minute direct train would win (25 + 20 = 45).
    expect(lines([...threeTrains(5), ...oneChange, ...directOf(40)])).toEqual(["Direct"]);
    const g = buildGraph(stations, [...threeTrains(5), ...oneChange, ...directOf(40)]);
    const r = route(g, "a", "d", { fewerChangesSlackMin: 0 })!;
    expect(r.legs.map((l) => l.line)).toEqual(["P", "Q"]);
    expect(r.minutes).toBe(25);
  });

  it("gives the same answer whatever order the edges come in", () => {
    const slowOneChange = [...ride("a", "e", "P", 15), ...ride("e", "d", "Q", 20)];
    const cases: [Edge[], string[]][] = [
      [[...threeTrains(5), ...directOf(50)], ["Direct"]],
      [[...threeTrains(5), ...directOf(51)], ["X", "Y", "Z"]],
      [[...threeTrains(5), ...slowOneChange, ...directOf(55)], ["P", "Q"]],
      [[...threeTrains(5), ...directOf(48), ...ride("a", "d", "Other", 45)], ["Other"]],
    ];
    for (const [edges, want] of cases) {
      for (let seed = 1; seed <= 25; seed++) {
        expect(lines(shuffled(edges, seed)), `seed ${seed}`).toEqual(want);
        expect(lines(shuffled(edges, seed), "d", "a"), `seed ${seed} back`).toEqual([...want].reverse());
      }
    }
  });
});

describe("route — inside one city, the fastest route", () => {
  const inCity = (cityId: string | null) => (id: string): Station => ({ id, name: id, lines: [], cityId });
  const sameCity = ["a", "b", "c", "d", "e", "h"].map(inCity("c1"));
  const edges = [...threeTrains(5), ...direct.slice(0, 2), ...ride("h", "d", "Direct", 40)];
  // threeTrains(5): 30 minutes, two changes. Direct: 41 minutes, no change.

  it("takes the fastest route when both stations are in the same city", () => {
    const r = route(buildGraph(sameCity, edges), "a", "d")!;
    expect(r.legs.map((l) => l.line)).toEqual(["X", "Y", "Z"]);
    expect(r.minutes).toBe(30);
  });

  it("takes the direct train when the stations are in different cities, or either has none", () => {
    const twoCities = sameCity.map((s) => (s.id === "d" ? { ...s, cityId: "c2" } : s));
    const noCity = sameCity.map((s) => (s.id === "a" ? { ...s, cityId: null } : s));
    for (const st of [twoCities, noCity]) {
      expect(route(buildGraph(st, edges), "a", "d")!.legs.map((l) => l.line)).toEqual(["Direct"]);
    }
  });

  it("lets the caller ask for the window inside a city", () => {
    const r = route(buildGraph(sameCity, edges), "a", "d", { fewerChangesSlackMin: FEWER_CHANGES_SLACK_MIN })!;
    expect(r.legs.map((l) => l.line)).toEqual(["Direct"]);
  });
});
