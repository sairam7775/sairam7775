import { describe, expect, it } from "vitest";
import { computeDayDiff, mergeProposals, parseProposal, routeDiffFrom, type RouteCity } from "../diff";
import type { DayPlan } from "@/lib/engine/types";
import { assessRoute, type CityFacts } from "@/lib/engine/route";
import { buildGraph } from "@/lib/transit/graph";
import { edges, stations } from "@/lib/transit/seed/kansai-sanyo";

describe("routeDiffFrom", () => {
  const graph = buildGraph(stations, edges);
  const fact = (id: string, name: string): [string, CityFacts] => [id, { id, name, tier: "stub", verifiedPlaces: 0, transitNote: null, hubStation: null }];
  const facts = new Map([fact("kyoto-city", "Kyoto"), fact("nara-city", "Nara"), fact("hiroshima-city", "Hiroshima")]);
  const input = [{ cityId: "kyoto-city", nights: 3 }, { cityId: "nara-city", nights: 0 }, { cityId: "hiroshima-city", nights: 2 }];
  const after: RouteCity[] = input.map((c) => ({
    cityId: c.cityId, name: facts.get(c.cityId)!.name, nights: c.nights, reason: null, budgetBand: null, arriveDate: null, departDate: null, tier: "stub",
  }));

  it("names the route without the engine's verdict word, and carries its trains", () => {
    const d = routeDiffFrom([], after, assessRoute(input, facts, graph, 5));
    expect(d.summary).toBe("Kyoto, 3 nights → Nara, day trip → Hiroshima, 2 nights");
    expect(d.legs?.map((l) => [l.fromCityId, l.toCityId, l.movingTo])).toEqual([
      ["kyoto-city", "nara-city", null],
      ["nara-city", "kyoto-city", null],
      ["kyoto-city", "hiroshima-city", "hiroshima-city"],
    ]);
    expect(d.legs?.[2].summary).toMatch(/Kyoto → Hiroshima/);
    expect(parseProposal({ summary: d.summary, route: d, days: [] })?.route?.legs).toHaveLength(3);
  });

  it("still reads a route proposal saved before it carried trains", () => {
    const old = routeDiffFrom([], after, assessRoute(input, facts, graph, 5));
    delete old.legs;
    expect(parseProposal({ summary: old.summary, route: old, days: [] })?.route?.legs).toBeUndefined();
  });
});

const item = (placeId: string, startMin: number, locked = false): DayPlan["items"][number] => ({
  placeId, name: placeId, category: "temple", startMin, endMin: startMin + 60, durationMin: 60, locked,
  score: { total: 1, terms: [] }, reason: "because", reasonTerms: ["interest_match"], arriveBy: null, alternatives: [], costJpy: 500,
});
const plan = (items: DayPlan["items"]): DayPlan => ({
  date: "2026-11-23", cityId: "kyoto-city", items, meals: [], startMin: 540, endMin: 1020, budgetMin: 480, activeMin: 300, slackMin: 180,
  placesJpy: 1000, faresJpy: 300, costJpy: 1300, fareKind: "estimate", considered: [], warnings: [],
});

describe("computeDayDiff", () => {
  it("flags kept, added, moved and removed against the existing day", () => {
    const existing = [
      { placeId: "a", name: "a", sortOrder: 0, startMin: 540, locked: false },
      { placeId: "b", name: "b", sortOrder: 1, startMin: 660, locked: false },
      { placeId: "c", name: "c", sortOrder: 2, startMin: 780, locked: false },
    ];
    const d = computeDayDiff(existing, plan([item("c", 540), item("a", 660), item("d", 780)]));
    expect(d.after.map((i) => [i.placeId, i.change])).toEqual([["c", "moved"], ["a", "moved"], ["d", "added"]]);
    expect(d.removed).toEqual([{ placeId: "b", name: "b" }]);
    expect(d.summary).toMatch(/1 added, 1 removed, 2 moved/);
    // Dropping the first stop shifts every clock but moves nothing.
    const shifted = computeDayDiff(existing, plan([item("b", 540), item("c", 660)]));
    expect(shifted.after.map((i) => i.change)).toEqual(["kept", "kept"]);
    expect(d.summary).toMatch(/~¥1,300/);
  });
  it("a fresh day is all additions and says how many stops", () => {
    const d = computeDayDiff([], plan([item("a", 540), item("b", 660)]));
    expect(d.after.every((i) => i.change === "added")).toBe(true);
    expect(d.summary).toMatch(/^2 stops/);
  });
});

describe("proposals", () => {
  it("round-trip through the schema and reject junk", () => {
    const d = computeDayDiff([], plan([item("a", 540)]));
    const p = { summary: "1 day", days: [d] };
    expect(parseProposal(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(parseProposal({ summary: "x", days: [{ kind: "day" }] })).toBeNull();
    expect(parseProposal("nope")).toBeNull();
  });
  it("merge keeps one diff per date, later wins", () => {
    const a = { summary: "a", days: [computeDayDiff([], plan([item("a", 540)]))] };
    const b = { summary: "b", days: [computeDayDiff([], plan([item("b", 540)]))] };
    const m = mergeProposals(a, b);
    expect(m.days).toHaveLength(1);
    expect(m.days[0].after[0].placeId).toBe("b");
    expect(m.summary).toBe("1 day");
  });
});
