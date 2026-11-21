import { describe, expect, it } from "vitest";
import { bothWays, buildGraph } from "@/lib/transit/graph";
import type { Edge, Station } from "@/lib/transit/types";
import type { PlaceInput } from "../types";
import { copy } from "@/copy";
import { stations as seedStations, edges as seedEdges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { CASTLE_DETOUR, DIRECT_WALK_MAX_MIN, MOBILITY_WALK_MAX_MIN, metresBetween, travelFromGraph } from "../travel";

// Stations with no city: route() would open the fewer-changes window here.
const stations: Station[] = ["a", "b", "c", "d", "h"].map((id) => ({ id, name: id, lines: [], cityId: null }));
const ride = (from: string, to: string, line: string, minutes: number): Edge[] =>
  bothWays({ from, to, line, mode: "rail", operator: "test", km: 1, minutes });
// Fastest: three trains, 10 + 5 + 5 + 5 + 5 = 30 minutes. Direct: 45.
const edges = [...ride("a", "b", "X", 10), ...ride("b", "c", "Y", 5), ...ride("c", "d", "Z", 5), ...ride("a", "h", "D", 1), ...ride("h", "d", "D", 44)];
const place = (id: string, station: string) => ({ id, nearestStation: station, stationWalkMin: 0 }) as unknown as PlaceInput;

describe("travelFromGraph", () => {
  it("times a day by the fastest route, whatever city data the stations carry", () => {
    const leg = travelFromGraph(buildGraph(stations, edges))(place("p", "a"), place("q", "d"))!;
    expect(leg.minutes).toBe(30);
    expect(leg.lines).toHaveLength(3);
  });

  const at = (id: string, station: string, lat: number, lon: number, walk = 0) =>
    ({ id, nearestStation: station, stationWalkMin: walk, lat, lon }) as unknown as PlaceInput;
  /** A latitude `m` metres north of 35°. */
  const north = (m: number) => 35 + m / 111_195;

  it("walks straight between two places close together when that beats the train", () => {
    // 400 m apart by different stations: 400 × 1.3 at 80 m a minute is 7
    // minutes on foot, not 30 minutes of trains.
    const leg = travelFromGraph(buildGraph(stations, edges))(at("p", "a", 35, 135), at("q", "d", north(400), 135))!;
    expect(leg).toMatchObject({ mode: "walk", minutes: 7, fareJpy: 0, lines: [] });
  });

  it("never offers a walk longer than the cap in place of a train", () => {
    // 1,500 m is 25 minutes on foot, over the cap: the 30-minute train stands.
    expect(DIRECT_WALK_MAX_MIN).toBeLessThan(25);
    const leg = travelFromGraph(buildGraph(stations, edges))(at("p", "a", 35, 135), at("q", "d", north(1500), 135))!;
    expect(leg).toMatchObject({ minutes: 30 });
    expect(leg.lines).toHaveLength(3);
  });

  it("by one station, takes the shorter of via the station and straight across, however long", () => {
    const travel = travelFromGraph(buildGraph(stations, edges));
    // 15 minutes out each, 400 m apart: 7, not (15 + 15) × 0.8 = 24.
    expect(travel(at("p", "a", 35, 135, 15), at("q", "a", north(400), 135, 15))!.minutes).toBe(7);
    // 5 minutes out each, on opposite sides 2 km apart: via the station, 8.
    expect(travel(at("r", "a", 35, 135, 5), at("s", "a", north(2000), 135, 5))!.minutes).toBe(8);
    // 25 minutes out each, 2 km apart: straight across (33) beats via the
    // station (40), past the cap: it was a walk either way.
    expect(travel(at("t", "a", 35, 135, 25), at("u", "a", north(2000), 135, 25))!.minutes).toBe(33);
  });

  it("says a straight walk is an estimate, and a walk via the station as before", () => {
    const travel = travelFromGraph(buildGraph(stations, edges));
    expect(travel(at("p", "a", 35, 135), at("q", "d", north(400), 135))!.detail).toBe(copy.plan.transit.walkStraight(7));
    expect(travel(at("r", "a", 35, 135, 5), at("s", "a", north(2000), 135, 5))!.detail).toBe(copy.plan.transit.walkOnly(8));
  });

  it("never walks straight in place of a train to or from a steep place or a hike: hills are in the way", () => {
    const travel = travelFromGraph(buildGraph(stations, edges));
    const steep = { ...at("hill", "d", north(400), 135), physicalDemand: 0.5 } as PlaceInput;
    const hike = { ...at("trail", "d", north(400), 135), category: "hike" } as PlaceInput;
    for (const q of [steep, hike]) {
      expect(travel(at("p", "a", 35, 135), q)!.minutes, q.id).toBe(30);
      expect(travel(q, at("p", "a", 35, 135))!.minutes, q.id).toBe(30);
    }
    // By one station, a hike goes via the station only, (15 + 15) × 0.8; a
    // steep place keeps the shorter walk (the slope is on either walk).
    const hikeNear = { ...at("trail2", "a", north(400), 135, 15), category: "hike" } as PlaceInput;
    const steepNear = { ...at("hill2", "a", north(400), 135, 15), physicalDemand: 0.6 } as PlaceInput;
    expect(travel(at("v", "a", 35, 135, 15), hikeNear)!.minutes).toBe(24);
    expect(travel(at("v", "a", 35, 135, 15), steepNear)!.minutes).toBe(7);
  });

  it("walks to and from a castle the long way round its moat", () => {
    // 400 m × 1.8 at 80 m a minute is 9 minutes, not 400 × 1.3's 7.
    expect(CASTLE_DETOUR).toBe(1.8);
    const travel = travelFromGraph(buildGraph(stations, edges));
    const keep = { ...at("keep", "d", north(400), 135), category: "castle" } as PlaceInput;
    expect(travel(at("p", "a", 35, 135), keep)).toMatchObject({ mode: "walk", minutes: 9 });
    expect(travel(keep, at("p", "a", 35, 135))).toMatchObject({ mode: "walk", minutes: 9 });
    const keepNear = { ...at("keep2", "a", north(400), 135, 15), category: "castle" } as PlaceInput;
    expect(travel(at("v", "a", 35, 135, 15), keepNear)!.minutes).toBe(9);
  });

  it("gives the real castles' neighbours a walk round the moat, not a train", () => {
    const real = travelFromGraph(buildGraph(seedStations, seedEdges));
    const seed = new Map(placeSeeds.flatMap((s) => s.places).map((p) => [p.id, seedToPlaceInput(p)]));
    // Each pair with the time it had while castles were never walked to.
    const pairs: [string, string, number][] = [
      ["osk-osaka-castle", "osk-museum-of-history", 39],
      ["hmj-castle", "hmj-kokoen", 24],
      ["hir-castle", "hir-gokoku-shrine", 19],
      ["osk-osaka-castle", "osk-castle-park", 16],
      ["hir-castle", "hir-shukkeien", 27],
    ];
    for (const [a, b, before] of pairs) {
      const p = seed.get(a)!;
      const q = seed.get(b)!;
      const roundTheMoat = Math.max(3, Math.ceil((metresBetween(p, q)! * CASTLE_DETOUR) / 80));
      for (const leg of [real(p, q)!, real(q, p)!]) {
        expect(leg, `${a} ↔ ${b}`).toMatchObject({ mode: "walk", minutes: roundTheMoat, detail: copy.plan.transit.walkStraight(roundTheMoat) });
        expect(leg.minutes, `${a} ↔ ${b}`).toBeLessThan(before);
      }
    }
  });

  it("lets a steep place with no station walk straight, since it has nothing else", () => {
    // Its only other time is the flat 45-minute guess, and the slope is
    // there whichever way you arrive. A hike still never does.
    const travel = travelFromGraph(buildGraph(stations, edges));
    const hill = { id: "hill3", nearestStation: null, stationWalkMin: null, lat: north(400), lon: 135, physicalDemand: 0.6 } as unknown as PlaceInput;
    expect(travel(at("p", "a", 35, 135), hill)).toMatchObject({ mode: "walk", minutes: 7 });
    const trail = { ...hill, id: "trail3", category: "hike" } as PlaceInput;
    expect(travel(at("p", "a", 35, 135), trail)).toBeNull();
    // A hard mobility need keeps its five minutes.
    expect(travelFromGraph(buildGraph(stations, edges), { mobility: ["wheelchair"] })(at("p", "a", 35, 135), hill)).toBeNull();
  });

  it("for a hard mobility need, walks straight only a few minutes", () => {
    expect(MOBILITY_WALK_MAX_MIN).toBe(5);
    const graph = buildGraph(stations, edges);
    for (const need of ["wheelchair", "limited_mobility", "step_free"]) {
      const travel = travelFromGraph(graph, { mobility: [need] });
      // 400 m (7 min) is past the cap: the train, as before.
      expect(travel(at("p", "a", 35, 135), at("q", "d", north(400), 135))!.minutes, need).toBe(30);
      // 200 m is 4 minutes: still the walk.
      expect(travel(at("p", "a", 35, 135), at("w", "d", north(200), 135))!.minutes, need).toBe(4);
    }
    // A soft preference ("fewer stairs" and the like) doesn't change it.
    expect(travelFromGraph(graph, { mobility: ["avoid_stairs"] })(at("p", "a", 35, 135), at("q", "d", north(400), 135))!.minutes).toBe(7);
  });
});
