/** Moving the dates under planned days, and re-laying a route over them. */
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store.memory";
import { shiftConflicts, staleDayDates } from "../shift";
import type { ItemRow } from "../store";
import type { Proposal } from "../diff";

const prefs = { pace: "standard" as const, interestTags: ["art"] as "art"[], energy: 0.4, crowdTolerance: 0.6, discovery: 0.5, excludes: [] };
const nov = { startDate: "2026-11-20", endDate: "2026-11-29" };
const item = (placeId: string, name: string): ItemRow => ({
  placeId, name, sortOrder: 0, startMin: 600, durationMin: 90, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null,
});
// 22 Nov 2026 is a Sunday; the National Museum is closed Mondays.
const sundayMuseum = { date: "2026-11-22", cityId: "kyoto-city", items: [item("kyt-national-museum", "Kyoto National Museum")] };
const store = (extra: Partial<ConstructorParameters<typeof MemoryStore>[0]> = {}) =>
  new MemoryStore({ trip: nov, prefs, cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 7 }], days: [sundayMuseum], ...extra });

describe("moving the dates under a plan", () => {
  it("refuses to put a Monday-closed stop on a Monday, and says which", async () => {
    const s = store();
    const err = await s.setTripDates({ startDate: "2026-11-21", endDate: "2026-11-30" }).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Kyoto National Museum is closed on Mondays/);
    expect((await s.state()).trip.startDate).toBe("2026-11-20");
    expect((await s.state()).days[0].date).toBe("2026-11-22");
  });

  it("allows a move that keeps every stop open, and carries the plan with it", async () => {
    const s = store();
    await s.setTripDates({ startDate: "2026-11-27", endDate: "2026-12-06" });
    expect((await s.state()).days[0].date).toBe("2026-11-29");
  });

  it("a stop that needs a ticket needs one for the new date too", async () => {
    const day = { date: "2026-11-21", cityId: "osaka-city", items: [item("osk-teamlab-botanical", "teamLab Botanical Garden")] };
    const ticket = { type: "activity", title: "teamLab Botanical Garden", startsOn: "2026-11-21", placeId: null };
    const s = store({ days: [day], bookings: [ticket] });
    const err = await s.setTripDates({ startDate: "2026-11-22", endDate: "2026-12-01" }).catch((e) => e);
    expect(err.message ?? "").toMatch(/needs a ticket/);
  });

  it("changing only the title or party size touches no day", async () => {
    const s = store();
    await s.setTripDates({ title: "Autumn", partySize: 2 });
    expect((await s.state()).days[0].date).toBe("2026-11-22");
  });
});

describe("shiftConflicts", () => {
  it("is empty for no shift", () => {
    expect(shiftConflicts([sundayMuseum], new Map(), [], 0)).toEqual([]);
  });
});

describe("staleDayDates", () => {
  const cities = (a: [string, string, string][]) => a.map(([cityId, arriveDate, departDate]) => ({ cityId, arriveDate, departDate }));
  const day = (date: string, cityId: string | null) => ({ date, cityId });

  it("drops days whose city was dropped from the route", () => {
    expect(staleDayDates([day("2026-11-20", "osaka-city")], cities([["kyoto-city", "2026-11-20", "2026-11-24"]]))).toEqual(["2026-11-20"]);
  });
  it("drops a day when a reordered route gives its date to another city", () => {
    const reordered = cities([["osaka-city", "2026-11-20", "2026-11-22"], ["kyoto-city", "2026-11-22", "2026-11-24"]]);
    expect(staleDayDates([day("2026-11-20", "kyoto-city"), day("2026-11-22", "kyoto-city"), day("2026-11-20", "osaka-city")], reordered)).toEqual(["2026-11-20"]);
  });
  it("keeps the departure day only for the last city", () => {
    const r = cities([["osaka-city", "2026-11-20", "2026-11-22"], ["kyoto-city", "2026-11-22", "2026-11-24"]]);
    expect(staleDayDates([day("2026-11-24", "kyoto-city"), day("2026-11-22", "osaka-city")], r)).toEqual(["2026-11-22"]);
  });
  it("keeps days with no city, and days in an undated route", () => {
    expect(staleDayDates([day("2026-11-20", null), day("2026-11-21", "kyoto-city")], cities([["kyoto-city", null as unknown as string, null as unknown as string]]))).toEqual([]);
  });
});

describe("accepting a reordered route", () => {
  it("drops the day the new order gives to another city", async () => {
    const s = new MemoryStore({
      trip: { startDate: "2026-11-20", endDate: "2026-11-24" },
      prefs,
      cities: [{ cityId: "kyoto-city", nights: 2 }, { cityId: "osaka-city", nights: 2 }],
      days: [{ date: "2026-11-20", cityId: "kyoto-city", items: [item("kyt-national-museum", "Kyoto National Museum")] }],
    });
    const proposal = {
      summary: "Osaka first",
      route: { before: [], after: [{ cityId: "osaka-city", nights: 2, reason: null, budgetBand: null }, { cityId: "kyoto-city", nights: 2, reason: null, budgetBand: null }] },
      days: [],
    } as unknown as Proposal;
    await s.applyProposal(proposal);
    expect((await s.state()).days).toHaveLength(0);
  });
});
