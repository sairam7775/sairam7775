import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed/kansai-sanyo";
import { allocateDates, assessRoute, suggestRoute, type CityFacts } from "../route";

const graph = buildGraph(stations, edges);
const facts = new Map<string, CityFacts>(
  [
    ["kyoto-city", "Kyoto", "deep", 41],
    ["osaka-city", "Osaka", "deep", 28],
    ["nara-city", "Nara", "deep", 26],
    ["hiroshima-city", "Hiroshima", "deep", 25],
    ["himeji", "Himeji", "outline", 6],
    ["takayama", "Takayama", "stub", 0],
  ].map(([id, name, tier, n]) => [id as string, { id: id as string, name: name as string, tier: tier as CityFacts["tier"], verifiedPlaces: n as number, transitNote: null, hubStation: null }]),
);

describe("assessRoute", () => {
  it("calls five cities in nine nights over-packed and shows the arithmetic", () => {
    const a = assessRoute(
      [
        { cityId: "osaka-city", nights: 2 },
        { cityId: "kyoto-city", nights: 2 },
        { cityId: "nara-city", nights: 2 },
        { cityId: "himeji", nights: 1 },
        { cityId: "hiroshima-city", nights: 2 },
      ],
      facts,
      graph,
      9,
    );
    expect(a.verdict).toBe("overpacked");
    expect(a.cityChanges).toBe(4);
    expect(a.nightsPerCity).toBeCloseTo(1.8);
    expect(a.arithmetic).toMatch(/5 cities in 9 nights/);
    expect(a.arithmetic).toMatch(/4 city changes/);
    expect(a.trainMinutes).toBeGreaterThan(0);
    expect(a.legs.every((l) => l.minutes != null)).toBe(true);
  });

  it("is fine with two cities and six nights", () => {
    const a = assessRoute([{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 4 }], facts, graph, 6);
    expect(a.verdict).toBe("fine");
    expect(a.legs[0].summary).toMatch(/Shin-Osaka → Kyoto/);
  });

  it("ignores day trips when counting city changes", () => {
    const a = assessRoute([{ cityId: "kyoto-city", nights: 4 }, { cityId: "nara-city", nights: 0 }], facts, graph, 4);
    expect(a.cityChanges).toBe(0);
    expect(a.verdict).toBe("fine");
  });

  it("says a stub city cannot be planned and flags a nights mismatch", () => {
    const a = assessRoute([{ cityId: "kyoto-city", nights: 3 }, { cityId: "takayama", nights: 2 }], facts, graph, 7);
    expect(a.cities[1].planning).toMatch(/doesn't know/);
    expect(a.reasons.some((r) => /Takayama is at stub tier/.test(r))).toBe(true);
    expect(a.nightsMismatch).toMatch(/7 nights.*uses 5/);
    expect(a.legs[0].minutes).toBeNull();
  });
});

describe("allocateDates", () => {
  it("gives the departure day to the next city and the last day to the last city", () => {
    const d = allocateDates("2026-11-20", [{ cityId: "osaka-city", nights: 2 }, { cityId: "nara-city", nights: 0 }, { cityId: "kyoto-city", nights: 3 }], "2026-11-25");
    expect(d[0]).toMatchObject({ arriveDate: "2026-11-20", departDate: "2026-11-22", dates: ["2026-11-20", "2026-11-21"] });
    expect(d[1].dates).toEqual([]);
    expect(d[2]).toMatchObject({ arriveDate: "2026-11-22", departDate: "2026-11-25", dates: ["2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"] });
  });

  it("has no dates without a start date", () => {
    expect(allocateDates(null, [{ cityId: "kyoto-city", nights: 3 }])[0].dates).toEqual([]);
  });
});

describe("suggestRoute", () => {
  it("does not move a two-night trip", () => {
    expect(suggestRoute(2).cities).toEqual([expect.objectContaining({ cityId: "kyoto-city", nights: 2 })]);
  });
  it("uses every night and never suggests an over-packed corridor", () => {
    for (let n = 3; n <= 14; n++) {
      const s = suggestRoute(n);
      expect(s.cities.reduce((t, c) => t + c.nights, 0)).toBe(n);
      const a = assessRoute(s.cities, facts, graph, n);
      expect(a.verdict, `nights=${n}`).not.toBe("overpacked");
    }
  });
});
