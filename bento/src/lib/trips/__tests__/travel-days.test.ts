import { describe, expect, it } from "vitest";
import type { RouteLegAssessment } from "@/lib/engine/route";
import { travelDayParts, travelDays } from "../travel-days";

const leg = (from: string, to: string, movingTo: string | null): RouteLegAssessment => ({
  fromCityId: from, toCityId: to, movingTo, minutes: 60, fareJpy: 1000, fareKind: "exact", summary: `${from} → ${to}`, lines: [],
});

describe("travelDays", () => {
  it("puts each move's trains on the day you arrive where you'll sleep, and day trips on none", () => {
    const cities = [
      { cityId: "kyoto-city", arriveDate: "2026-11-22" },
      { cityId: "hiroshima-city", arriveDate: "2026-11-27" },
    ];
    const legs = [
      leg("kyoto-city", "nara-city", null),
      leg("nara-city", "kyoto-city", null),
      leg("kyoto-city", "himeji", "hiroshima-city"),
      leg("himeji", "hiroshima-city", "hiroshima-city"),
    ];
    const days = travelDays(cities, legs);
    expect([...days.keys()]).toEqual(["2026-11-27"]);
    expect(days.get("2026-11-27")!.map((l) => l.toCityId)).toEqual(["himeji", "hiroshima-city"]);
  });

  it("leaves out a move to a stay that has no date yet", () => {
    expect(travelDays([{ cityId: "hiroshima-city", arriveDate: null }], [leg("kyoto-city", "hiroshima-city", "hiroshima-city")]).size).toBe(0);
  });
});

describe("travelDayParts", () => {
  // 23 Nov 2026 read-through: on the Himeji day the evening train on to
  // Hiroshima sat beside the morning train, above the castle, as if you
  // went on first. The ride out of the day's own city comes after the day.
  it("puts the ride out of the day's city after the day, and the ride there before it", () => {
    const legs = [leg("kyoto-city", "himeji", "hiroshima-city"), leg("himeji", "hiroshima-city", "hiroshima-city")];
    const parts = travelDayParts(legs, "himeji");
    expect(parts.there.map((l) => l.toCityId)).toEqual(["himeji"]);
    expect(parts.onward.map((l) => l.fromCityId)).toEqual(["himeji"]);
  });

  it("has nothing onward on an ordinary travel day", () => {
    const parts = travelDayParts([leg("tokyo-city", "kyoto-city", "kyoto-city")], "kyoto-city");
    expect(parts.there).toHaveLength(1);
    expect(parts.onward).toEqual([]);
  });
});
