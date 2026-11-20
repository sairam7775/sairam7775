/** Closures on dates that come round every year: Japan's year-end break
 *  (roughly 28 Dec – 4 Jan, different for each place). A trip on 1 Jan 2027
 *  in Osaka once scheduled Osaka Castle's main tower and the Osaka Museum of
 *  History, both shut over New Year, with no warning. */
import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { osaka as osakaSeed } from "@/lib/places/seed/osaka";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { copy } from "@/copy";
import { closedYearlyOn, isYearlyRange, yearlyRangeWords } from "../closures";
import { hardFilter } from "../filter";
import { planDay } from "../schedule";
import { travelFromGraph } from "../travel";
import { kyoto, owner } from "../__fixtures__/kyoto";

const travel = travelFromGraph(buildGraph(stations, edges));
const osaka = osakaSeed.map((s) => seedToPlaceInput(s));
const traveller = { pace: "standard" as const, interestTags: [], energy: 0.5, crowdTolerance: 0.6, discovery: 0.5, excludes: [], mobility: [], budgetBand: null };
const ctxOn = (date: string) => ({ date, weekday: new Date(`${date}T00:00:00Z`).getUTCDay(), bookedPlaceIds: new Set<string>(), usedPlaceIds: new Set<string>() });
const museum = kyoto.find((p) => p.id === "kyt-sanjusangendo")!;

describe("a yearly range", () => {
  it("is MM-DD or MM-DD..MM-DD with real months and days", () => {
    for (const ok of ["12-28..01-01", "01-01", "12-29..12-31", "02-29", "01-31..02-01"]) expect(isYearlyRange(ok), ok).toBe(true);
    for (const bad of ["13-01", "12-32", "00-10", "12-28-01-01", "12-28..", "2026-12-28", "12/28", "1-1", "12-28..01-01 ", "04-31", "02-30"]) expect(isYearlyRange(bad), bad).toBe(false);
  });

  it("wraps the year: 12-28..01-01 covers 28 Dec to 1 Jan and nothing either side", () => {
    const p = { closedYearly: ["12-28..01-01"] };
    for (const d of ["2026-12-28", "2026-12-31", "2027-01-01"]) expect(closedYearlyOn(p, d), d).toBe("12-28..01-01");
    for (const d of ["2026-12-27", "2027-01-02", "2027-06-15"]) expect(closedYearlyOn(p, d), d).toBeNull();
  });

  it("does not wrap a range inside one year, and a single day is that day", () => {
    expect(closedYearlyOn({ closedYearly: ["12-29..12-31"] }, "2026-12-30")).toBe("12-29..12-31");
    expect(closedYearlyOn({ closedYearly: ["12-29..12-31"] }, "2027-01-01")).toBeNull();
    expect(closedYearlyOn({ closedYearly: ["01-01"] }, "2027-01-01")).toBe("01-01");
    expect(closedYearlyOn({ closedYearly: ["01-01"] }, "2027-01-02")).toBeNull();
    expect(closedYearlyOn({}, "2027-01-01")).toBeNull();
  });

  it("reads as day and month, the way copy.locale writes dates", () => {
    expect(yearlyRangeWords("12-28..01-01")).toBe("28 Dec – 1 Jan");
    expect(yearlyRangeWords("01-01")).toBe("1 Jan");
  });
});

describe("the filter", () => {
  it("leaves out a place on a date it closes every year, with its own reason", () => {
    const shut = { ...museum, closedYearly: ["12-28..01-01"] };
    expect(hardFilter(shut, owner, ctxOn("2027-01-01"))).toMatchObject({ stage: "filter", term: "closed", detail: copy.plan.leftOut.closedYearly("28 Dec – 1 Jan") });
    expect(copy.plan.leftOut.closedYearly("28 Dec – 1 Jan")).toBe("closed 28 Dec – 1 Jan every year");
    expect(hardFilter(shut, owner, ctxOn("2027-01-05"))).toBeNull();
  });
});

describe("1 Jan 2027 in Osaka", () => {
  it("plans neither the castle's main tower nor the Museum of History, and says why", () => {
    const plan = planDay({ date: "2027-01-01", cityId: "osaka-city", places: osaka, traveller, travel });
    const ids = plan.items.map((i) => i.placeId);
    expect(ids).not.toContain("osk-osaka-castle");
    expect(ids).not.toContain("osk-museum-of-history");
    const why = (id: string) => plan.considered.find((r) => r.placeId === id);
    expect(why("osk-osaka-castle")).toMatchObject({ term: "closed", detail: "closed 28 Dec – 1 Jan every year" });
    expect(why("osk-museum-of-history")).toMatchObject({ term: "closed", detail: "closed 28 Dec – 4 Jan every year" });
    expect(plan.items.length).toBeGreaterThan(0);
  });

  it("keeps a pinned castle and warns that it is closed that day", () => {
    const plan = planDay({ date: "2027-01-01", cityId: "osaka-city", places: osaka, traveller, travel, locked: [{ placeId: "osk-osaka-castle" }] });
    expect(plan.items.map((i) => i.placeId)).toContain("osk-osaka-castle");
    expect(plan.warnings).toContain("Osaka Castle is pinned but closed 28 Dec – 1 Jan every year — kept because you pinned it");
  });

  it("plans the castle again on 2 Jan", () => {
    const plan = planDay({ date: "2027-01-02", cityId: "osaka-city", places: osaka, traveller, travel, locked: [{ placeId: "osk-osaka-castle" }] });
    expect(plan.warnings.filter((w) => /pinned but/.test(w))).toEqual([]);
  });
});
