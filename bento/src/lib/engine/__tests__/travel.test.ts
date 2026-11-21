import { describe, expect, it } from "vitest";
import { bothWays, buildGraph } from "@/lib/transit/graph";
import type { Edge, Station } from "@/lib/transit/types";
import type { PlaceInput } from "../types";
import { copy } from "@/copy";
import { DIRECT_WALK_MAX_MIN, MOBILITY_WALK_MAX_MIN, travelFromGraph } from "../travel";

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

  it("never walks straight in place of a train to or from a steep place, a hike or a castle: hills and moats are in the way", () => {
    const travel = travelFromGraph(buildGraph(stations, edges));
    const steep = { ...at("hill", "d", north(400), 135), physicalDemand: 0.5 } as PlaceInput;
    const hike = { ...at("trail", "d", north(400), 135), category: "hike" } as PlaceInput;
    const castle = { ...at("keep", "d", north(400), 135), category: "castle" } as PlaceInput;
    for (const q of [steep, hike, castle]) {
      expect(travel(at("p", "a", 35, 135), q)!.minutes, q.id).toBe(30);
      expect(travel(q, at("p", "a", 35, 135))!.minutes, q.id).toBe(30);
    }
    // By one station, a hike or a castle goes via the station only,
    // (15 + 15) × 0.8; a steep place keeps the shorter walk (the slope is on
    // either walk).
    const hikeNear = { ...at("trail2", "a", north(400), 135, 15), category: "hike" } as PlaceInput;
    const castleNear = { ...at("keep2", "a", north(400), 135, 15), category: "castle" } as PlaceInput;
    const steepNear = { ...at("hill2", "a", north(400), 135, 15), physicalDemand: 0.6 } as PlaceInput;
    expect(travel(at("v", "a", 35, 135, 15), hikeNear)!.minutes).toBe(24);
    expect(travel(at("v", "a", 35, 135, 15), castleNear)!.minutes).toBe(24);
    expect(travel(at("v", "a", 35, 135, 15), steepNear)!.minutes).toBe(7);
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
