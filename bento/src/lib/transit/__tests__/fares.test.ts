/** A ride Bento can't price is said so — never shown as free. */
import { describe, expect, it } from "vitest";
import { buildGraph, route } from "../graph";
import { describeRoute } from "../describe";
import type { Edge, Station } from "../types";

const st = (id: string): Station => ({ id, name: id.toUpperCase(), lines: [] });
const stations = [st("a"), st("b"), st("c")];

describe("fares Bento cannot price", () => {
  it("an operator with no fare table is unpriced, not ¥0", () => {
    const edges: Edge[] = [{ from: "a", to: "b", line: "City Bus 5", mode: "bus", operator: "KyotoCityBus", km: 3, minutes: 12 }];
    const r = route(buildGraph(stations, edges), "a", "b")!;
    expect(r.fareJpy).toBe(0);
    expect(r.unpricedRides).toBe(1);
    expect(describeRoute(r).summary).toContain("fare not in Bento yet");
    expect(describeRoute(r).summary).not.toContain("free");
  });

  it("a run with no distance is unpriced, not the minimum band", () => {
    const edges: Edge[] = [{ from: "a", to: "b", line: "JR Nara Line · Local", mode: "rail", operator: "jr-west", km: null, minutes: 10 }];
    const r = route(buildGraph(stations, edges), "a", "b")!;
    expect(r.unpricedRides).toBe(1);
  });

  it("a priced ride plus an unpriced one says both", () => {
    const edges: Edge[] = [
      { from: "a", to: "b", line: "Ferry", mode: "ferry", operator: null, km: null, minutes: 10, fareJpy: 200 },
      { from: "b", to: "c", line: "City Bus 5", mode: "bus", operator: "KyotoCityBus", km: 3, minutes: 12 },
    ];
    const r = route(buildGraph(stations, edges), "a", "c")!;
    expect(describeRoute(r).summary).toMatch(/¥200 \+ a fare not in Bento yet/);
  });
});
