import { describe, expect, it } from "vitest";
import { coverageShown, trainRows, uncoveredStays } from "../route-card";

const leg = (from: string, to: string, movingTo: string | null, summary = `${from} → ${to}`) => ({ fromCityId: from, toCityId: to, movingTo, summary, lines: [`${summary} line`] });
const city = (name: string, nights: number, tier: "deep" | "outline" | "stub") => ({ name, nights, tier });

describe("trainRows", () => {
  it("shows a day trip there and back once, and every leg of a move", () => {
    const rows = trainRows([
      leg("kyoto-city", "nara-city", null, "Kyoto → Nara"),
      leg("nara-city", "kyoto-city", null, "Nara → Kyoto"),
      leg("kyoto-city", "himeji", "hiroshima-city", "Kyoto → Himeji"),
      leg("himeji", "hiroshima-city", "hiroshima-city", "Himeji → Hiroshima"),
    ]);
    expect(rows.map((r) => [r.summary, r.back])).toEqual([
      ["Kyoto → Nara", true],
      ["Kyoto → Himeji", false],
      ["Himeji → Hiroshima", false],
    ]);
    expect(rows[0].lines).toEqual(["Kyoto → Nara line"]);
  });

  it("keeps a one-way leg with no way back as it is", () => {
    expect(trainRows([leg("kyoto-city", "nara-city", null)]).map((r) => r.back)).toEqual([false]);
  });
});

describe("coverageShown", () => {
  it("says it per city when the route mixes how well Bento knows them", () => {
    expect(coverageShown([city("Kyoto", 5, "deep"), city("Himeji", 0, "stub")])).toEqual({ perCity: true, everywhere: null });
  });

  it("says it once when every stop is the same", () => {
    expect(coverageShown([city("Kyoto", 5, "deep"), city("Nara", 0, "deep")])).toEqual({ perCity: false, everywhere: "deep" });
    expect(coverageShown([city("Osaka", 2, "stub"), city("Kyoto", 5, "stub")])).toEqual({ perCity: false, everywhere: "stub" });
  });
});

describe("uncoveredStays", () => {
  it("names the places you sleep that Bento can't plan days in", () => {
    expect(uncoveredStays([city("Osaka", 2, "stub"), city("Nara", 0, "stub"), city("Kyoto", 5, "deep"), city("Hiroshima", 2, "stub")]))
      .toEqual({ names: ["Osaka", "Hiroshima"], all: false });
  });

  it("says when it is every place you sleep", () => {
    expect(uncoveredStays([city("Osaka", 2, "stub"), city("Kyoto", 5, "stub")])).toEqual({ names: ["Osaka", "Kyoto"], all: true });
  });

  it("is empty when every stay can be planned", () => {
    expect(uncoveredStays([city("Kyoto", 5, "deep"), city("Himeji", 0, "stub"), city("Nara", 1, "outline")])).toEqual({ names: [], all: false });
  });
});
