import { describe, expect, it } from "vitest";
import { bothWays, buildGraph } from "@/lib/transit/graph";
import type { Edge, Station } from "@/lib/transit/types";
import type { PlaceInput } from "../types";
import { DIRECT_WALK_MAX_MIN, travelFromGraph } from "../travel";

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
});
