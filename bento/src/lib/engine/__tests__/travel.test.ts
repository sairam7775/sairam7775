import { describe, expect, it } from "vitest";
import { bothWays, buildGraph } from "@/lib/transit/graph";
import type { Edge, Station } from "@/lib/transit/types";
import type { PlaceInput } from "../types";
import { travelFromGraph } from "../travel";

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
});
