import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed/kansai-sanyo";
import { allocateDates, assessRoute, hubFor, stopKinds, suggestRoute, type CityFacts } from "../route";
import * as tokyoSeed from "@/lib/transit/seed/tokyo";
import * as allSeeds from "@/lib/transit/seed";
import { cityTrainMinutes } from "../travel-day";
import { copy } from "@/copy";

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
    expect(a.legs[0].summary).toMatch(/Osaka → Kyoto/);
    expect(a.legs[0]).toMatchObject({
      fromStation: { name: "Osaka", lat: 34.7025, lon: 135.4959 },
      toStation: { name: "Kyoto", lat: 34.9858, lon: 135.7588 },
    });
  });

  it("ignores day trips when counting city changes", () => {
    const a = assessRoute([{ cityId: "kyoto-city", nights: 4 }, { cityId: "nara-city", nights: 0 }], facts, graph, 4);
    expect(a.cityChanges).toBe(0);
    expect(a.verdict).toBe("fine");
  });

  it("says a stub city cannot be planned and flags a nights mismatch", () => {
    const a = assessRoute([{ cityId: "kyoto-city", nights: 3 }, { cityId: "takayama", nights: 2 }], facts, graph, 7);
    expect(a.cities[1].planning).toMatch(/doesn't know/);
    expect(a.reasons).toContain(copy.plan.route.notCovered("Takayama"));
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

describe("assessRoute — 0-night cities", () => {
  const pairs = (a: ReturnType<typeof assessRoute>) => a.legs.map((l) => `${l.fromCityId}>${l.toCityId}`);

  it("costs a day trip as there and back from where you sleep", () => {
    const a = assessRoute([{ cityId: "kyoto-city", nights: 3 }, { cityId: "nara-city", nights: 0 }, { cityId: "hiroshima-city", nights: 2 }], facts, graph, 5);
    expect(pairs(a)).toEqual(["kyoto-city>nara-city", "nara-city>kyoto-city", "kyoto-city>hiroshima-city"]);
  });

  it("costs a stop on the way as part of the journey", () => {
    const a = assessRoute([{ cityId: "kyoto-city", nights: 3 }, { cityId: "himeji", nights: 0 }, { cityId: "hiroshima-city", nights: 2 }], facts, graph, 5);
    expect(pairs(a)).toEqual(["kyoto-city>himeji", "himeji>hiroshima-city"]);
  });

  it("says which stay each journey leads to; a there-and-back day trip leads to none", () => {
    const a = assessRoute(
      [{ cityId: "kyoto-city", nights: 3 }, { cityId: "nara-city", nights: 0 }, { cityId: "himeji", nights: 0 }, { cityId: "hiroshima-city", nights: 2 }],
      facts,
      graph,
      5,
    );
    expect(a.legs.map((l) => `${l.fromCityId}>${l.toCityId}:${l.movingTo}`)).toEqual([
      "kyoto-city>nara-city:null",
      "nara-city>kyoto-city:null",
      "kyoto-city>himeji:hiroshima-city",
      "himeji>hiroshima-city:hiroshima-city",
    ]);
  });

  it("a day trip before the first stay goes from the first place you sleep", () => {
    const a = assessRoute([{ cityId: "nara-city", nights: 0 }, { cityId: "kyoto-city", nights: 3 }], facts, graph, 3);
    expect(pairs(a)).toEqual(["kyoto-city>nara-city", "nara-city>kyoto-city"]);
  });

  // all-nine-14, 23 Nov 2026: Yokohama was a day trip from Tokyo on day 5,
  // but Tokyo → Yokohama plus Yokohama → Kyoto came within the "on the way"
  // allowance, so day 6's card went Tokyo → Yokohama → Shinagawa → Kyoto
  // while the planner allowed for Tokyo → Kyoto. When the day each
  // zero-night city is spent is known, that decides it.
  const kanto = buildGraph(allSeeds.stations, allSeeds.edges);
  const tokyoKyoto = [{ cityId: "tokyo-city", nights: 5 }, { cityId: "kamakura", nights: 0 }, { cityId: "yokohama", nights: 0 }, { cityId: "kyoto-city", nights: 4 }];

  it("goes straight to the next stay when a zero-night city's day is not the day of the move", () => {
    const stops = stopKinds(tokyoKyoto, [{ day: 2, cityId: "kamakura" }, { day: 4, cityId: "yokohama" }]);
    expect([...stops]).toEqual([["kamakura", "day-trip"], ["yokohama", "day-trip"]]);
    const a = assessRoute(tokyoKyoto, facts, kanto, 9, stops);
    expect(a.legs.map((l) => `${l.fromCityId}>${l.toCityId}:${l.movingTo}`)).toEqual([
      "tokyo-city>kamakura:null", "kamakura>tokyo-city:null",
      "tokyo-city>yokohama:null", "yokohama>tokyo-city:null",
      "tokyo-city>kyoto-city:kyoto-city",
    ]);
    // The card's train is the one the planner allows for that day.
    expect(a.legs[4].minutes).toBe(cityTrainMinutes(kanto)("tokyo-city", "kyoto-city"));
  });

  it("keeps a zero-night city on the way when its day is the day of the move", () => {
    const himeji = [{ cityId: "kyoto-city", nights: 2 }, { cityId: "himeji", nights: 0 }, { cityId: "hiroshima-city", nights: 2 }];
    const onTheWay = stopKinds(himeji, [{ day: 2, cityId: "himeji" }]);
    expect(onTheWay.get("himeji")).toBe("on-the-way");
    expect(pairs(assessRoute(himeji, facts, graph, 4, onTheWay))).toEqual(["kyoto-city>himeji", "himeji>hiroshima-city"]);
    // The same city a day earlier is a day trip from Kyoto, though it lies
    // on the line to Hiroshima.
    const dayTrip = stopKinds(himeji, [{ day: 1, cityId: "himeji" }]);
    expect(dayTrip.get("himeji")).toBe("day-trip");
    expect(pairs(assessRoute(himeji, facts, graph, 4, dayTrip))).toEqual(["kyoto-city>himeji", "himeji>kyoto-city", "kyoto-city>hiroshima-city"]);
  });

  it("is never on the way with no stay before it or none after it", () => {
    expect(stopKinds([{ cityId: "nara-city", nights: 0 }, { cityId: "kyoto-city", nights: 3 }], [{ day: 0, cityId: "nara-city" }]).get("nara-city")).toBe("day-trip");
    expect(stopKinds([{ cityId: "hiroshima-city", nights: 2 }, { cityId: "miyajima", nights: 0 }], [{ day: 2, cityId: "miyajima" }]).get("miyajima")).toBe("day-trip");
  });

  it("still guesses from the trains when no day is known (a route proposed in the chat)", () => {
    expect(stopKinds(tokyoKyoto, []).size).toBe(0);
    expect(pairs(assessRoute(tokyoKyoto, facts, kanto, 9))).toContain("yokohama>kyoto-city");
  });
});

describe("hubFor", () => {
  const both = buildGraph([...stations, ...tokyoSeed.stations], [...edges, ...tokyoSeed.edges]);

  // Tokyo legs start at Tokyo Station, where the Shinkansen does, not at
  // whichever Tokyo station the database happened to list first.
  it("lands a Tokyo leg at Tokyo Station", () => {
    expect(hubFor("tokyo-city", both)).toBe("tokyo");
  });

  it("picks the same station for an unmapped city whatever order the stations load in", () => {
    const reversed = buildGraph([...tokyoSeed.stations, ...stations].reverse(), [...edges, ...tokyoSeed.edges]);
    expect(hubFor("narita", both)).toBe("narita-t1");
    expect(hubFor("narita", reversed)).toBe("narita-t1");
  });

  it("falls back the same way when the mapped station is not in the graph", () => {
    const tokyoOnly = [...tokyoSeed.stations].filter((s) => s.id !== "tokyo");
    const a = buildGraph(tokyoOnly, []);
    const b = buildGraph([...tokyoOnly].reverse(), []);
    expect(hubFor("tokyo-city", a)).toBe(hubFor("tokyo-city", b));
  });

  it("has no hub for a city with no stations", () => {
    expect(hubFor("kamakura", both)).toBeNull();
  });
});

describe("city-to-city legs start where the traveller is", () => {
  // Osaka's hub is Osaka Station (Umeda), where a stay in Osaka starts, not
  // Shin-Osaka, which is only where the Shinkansen stops. From Shin-Osaka
  // the Kyoto leg was a 13-minute Nozomi whose own note says it isn't worth
  // it over the Special Rapid.
  const all = buildGraph(allSeeds.stations, allSeeds.edges);
  const leg = (a: string, b: string) => {
    const l = assessRoute([{ cityId: a, nights: 2 }, { cityId: b, nights: 2 }], facts, all, 4).legs[0];
    return { minutes: l.minutes, fareJpy: l.fareJpy, lines: l.lines };
  };

  it("lands an Osaka leg at Osaka Station", () => {
    expect(hubFor("osaka-city", all)).toBe("osaka");
  });

  it("takes the Special Rapid between Osaka and Kyoto, both ways", () => {
    expect(leg("osaka-city", "kyoto-city")).toEqual({ minutes: 29, fareJpy: 580, lines: [expect.stringMatching(/^JR Kyoto Line · Special Rapid · Osaka → Kyoto · .*29 min · ¥580/)] });
    expect(leg("kyoto-city", "osaka-city")).toEqual({ minutes: 29, fareJpy: 580, lines: [expect.stringMatching(/^JR Kyoto Line · Special Rapid · Kyoto → Osaka · .*29 min · ¥580/)] });
    expect(cityTrainMinutes(all)("osaka-city", "kyoto-city")).toBe(29);
  });

  it("keeps Kyoto → Hiroshima on the through Nozomi", () => {
    expect(leg("kyoto-city", "hiroshima-city")).toMatchObject({ minutes: 100, fareJpy: 10890, lines: [expect.stringMatching(/^Tokaido–Sanyo Shinkansen · Nozomi · Kyoto → Hiroshima/)] });
  });

  // A change between the Shinkansen and the other JR lines at Shin-Osaka
  // costs 10 minutes, not the usual 5 (SLOW_CHANGES in transit/graph.ts).
  it("goes from Osaka to Hiroshima by the Shinkansen from Shin-Osaka", () => {
    const l = leg("osaka-city", "hiroshima-city");
    expect(l.lines.map((s) => s.split(" · ").slice(0, 2).join(" · "))).toEqual(["JR Kyoto Line · Osaka → Shin-Osaka", "Sanyo Shinkansen · Nozomi"]);
    expect(l.minutes).toBe(4 + 10 + 85);
  });

  it("goes from Osaka to Tokyo by the Shinkansen from Shin-Osaka", () => {
    const head = (l: { lines: string[] }) => l.lines.map((s) => s.split(" · ").slice(0, 2).join(" · "));
    const tokyo = leg("osaka-city", "tokyo-city");
    expect(head(tokyo)).toEqual(["JR Kyoto Line · Osaka → Shin-Osaka", "Tokaido Shinkansen · Nozomi"]);
    expect(tokyo.minutes).toBe(4 + 10 + 147);
  });

  it("goes between Osaka and Himeji on the direct Special Rapid, both ways, not by a change at Shin-Osaka", () => {
    for (const [a, b, from, to] of [["osaka-city", "himeji", "Osaka", "Himeji"], ["himeji", "osaka-city", "Himeji", "Osaka"]]) {
      expect(leg(a, b)).toEqual({ minutes: 62, fareJpy: 1520, lines: [expect.stringMatching(new RegExp(`^JR Kobe Line · Special Rapid · ${from} → ${to} · `))] });
    }
  });

  it("goes from Kyoto to Himeji on one through Shinkansen, one fare, without the Kyoto–Shin-Osaka note", () => {
    const l = assessRoute([{ cityId: "kyoto-city", nights: 2 }, { cityId: "himeji", nights: 2 }], facts, all, 4).legs[0];
    expect(l).toMatchObject({ minutes: 50, fareJpy: 4740, fareKind: "exact" });
    expect(l.lines).toEqual([expect.stringMatching(/^Tokaido–Sanyo Shinkansen · Hikari · Kyoto → Himeji/)]);
    expect(l.summary).toMatch(/no changes/);
    expect(l.lines.join(" ")).not.toMatch(/Not worth it/);
  });

  it("leaves Kyoto ⇄ Nara on the Kintetsu limited express", () => {
    expect(leg("kyoto-city", "nara-city")).toMatchObject({ minutes: 35, fareJpy: 1280, lines: [expect.stringMatching(/^Kintetsu Kyoto Line · Limited Express · Kyoto → Kintetsu-Nara/)] });
  });

  it("never offers the Kyoto–Shin-Osaka Nozomi for an Osaka–Nara day trip", () => {
    expect(leg("osaka-city", "nara-city").lines.join(" ")).not.toMatch(/Shinkansen/);
  });
});
