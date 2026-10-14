/** "excludes is a hard filter": never means never, however it was said. */
import { describe, expect, it } from "vitest";
import { hardFilter, normaliseTerm } from "../filter";
import { kyoto, owner } from "../__fixtures__/kyoto";

const ctx = { date: "2026-11-24", weekday: 2, bookedPlaceIds: new Set<string>(), usedPlaceIds: new Set<string>() };
const hike = kyoto.find((p) => p.id === "kyt-daimonji-hike")!;

describe("normaliseTerm", () => {
  it("lowercases, joins words and makes simple plurals singular", () => {
    expect(normaliseTerm("Beaches")).toBe("beach");
    expect(normaliseTerm("temples")).toBe("temple");
    expect(normaliseTerm("Theme parks")).toBe("theme_park");
    expect(normaliseTerm("galleries")).toBe("gallery");
    expect(normaliseTerm("onsen")).toBe("onsen");
  });
  it("maps the words people use to stored categories", () => {
    expect(normaliseTerm("hiking")).toBe("hike");
    expect(normaliseTerm("Hot springs")).toBe("onsen");
  });
});

describe("excludes", () => {
  it("'hiking' removes a hike even when it isn't strenuous", () => {
    const gentle = { ...hike, energy: 0.4, physicalDemand: 0.4 };
    expect(hardFilter(gentle, owner, ctx)).toMatchObject({ term: "excluded" });
  });
  it("matches regardless of case and plural", () => {
    const beach = { ...hike, id: "x-beach", category: "beach", energy: 0.1, physicalDemand: 0.1, interestTags: [] };
    for (const said of ["beaches", "Beaches", "beach", "BEACH"]) {
      expect(hardFilter(beach, { ...owner, excludes: [said] }, ctx)).toMatchObject({ term: "excluded" });
    }
  });
  it("matches tags too", () => {
    const place = { ...hike, id: "x-temple", category: "temple", interestTags: ["shrines"] as typeof hike.interestTags, energy: 0.1, physicalDemand: 0.1 };
    expect(hardFilter(place, { ...owner, excludes: ["Shrine"] }, ctx)).toMatchObject({ term: "excluded" });
  });
});
