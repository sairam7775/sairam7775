import { describe, expect, it } from "vitest";
import { coverageShown, hasKnownTrains, routeWideCoverage, trainRows, uncoveredStays } from "../route-card";
import { copy } from "@/copy";

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
    expect(rows.map((r) => [r.summary, r.back?.summary ?? null])).toEqual([
      ["Kyoto → Nara", "Nara → Kyoto"],
      ["Kyoto → Himeji", null],
      ["Himeji → Hiroshima", null],
    ]);
    // The way back keeps its own lines: it can be a different service.
    expect(rows[0].lines).toEqual(["Kyoto → Nara line"]);
    expect(rows[0].back?.lines).toEqual(["Nara → Kyoto line"]);
  });

  it("keeps a one-way leg with no way back as it is", () => {
    expect(trainRows([leg("kyoto-city", "nara-city", null)]).map((r) => r.back)).toEqual([null]);
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

describe("routeWideCoverage", () => {
  it("says it once for a route that is all the same, unless the note above Accept already does", () => {
    expect(routeWideCoverage([city("Kyoto", 5, "deep"), city("Nara", 0, "deep")])).toBe("deep");
    expect(routeWideCoverage([city("Osaka", 2, "stub"), city("Nara", 0, "stub")])).toBeNull();
    expect(routeWideCoverage([city("Kyoto", 5, "deep"), city("Himeji", 0, "stub")])).toBeNull();
  });

  it("still says it for a route of day trips only, which the note doesn't cover", () => {
    expect(routeWideCoverage([city("Nara", 0, "stub"), city("Himeji", 0, "stub")])).toBe("stub");
    // With nowhere to sleep the engine builds no journeys, so no trains are promised.
    expect(copy.proposal.canPlanEverywhere.stub).not.toMatch(/train/i);
    // Nor per city: a stop outside Bento's train data has none. The trains
    // list says which journeys Bento knows.
    expect(copy.proposal.canPlan.stub).not.toMatch(/train/i);
  });
});

describe("the note above Accept", () => {
  it("promises dates only when the route has them", () => {
    expect(copy.proposal.limits("Kyoto", false, true, true)).toMatch(/route and dates/);
    expect(copy.proposal.limits("Kyoto", false, false, true)).not.toMatch(/dates/);
    expect(copy.proposal.limits("Kyoto", false, false, true)).toMatch(/sets your route/);
  });

  it("promises trains only when Bento knows a journey on the route", () => {
    expect(copy.proposal.limits("Kyoto", false, true, true)).toMatch(/train/);
    expect(copy.proposal.limits("Kyoto", false, true, false)).not.toMatch(/train/);
  });
});

describe("hasKnownTrains", () => {
  it("is true only when a leg has lines from Bento's train data", () => {
    expect(hasKnownTrains([leg("kyoto-city", "nara-city", null)])).toBe(true);
    expect(hasKnownTrains([{ ...leg("takayama", "kyoto-city", "kyoto-city"), lines: [] }])).toBe(false);
    expect(hasKnownTrains(undefined)).toBe(false);
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

  it("names the stays, not 'any of these places', when a day-trip stop can be planned", () => {
    expect(uncoveredStays([city("Osaka", 2, "stub"), city("Nara", 0, "deep"), city("Kyoto", 5, "stub")]))
      .toEqual({ names: ["Osaka", "Kyoto"], all: false });
  });

  it("is empty when every stay can be planned", () => {
    expect(uncoveredStays([city("Kyoto", 5, "deep"), city("Himeji", 0, "stub"), city("Nara", 1, "outline")])).toEqual({ names: [], all: false });
  });
});
