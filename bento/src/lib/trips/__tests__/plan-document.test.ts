import { describe, expect, it } from "vitest";
import { planDocument, type DocBooking } from "../plan-document";
import type { PlaceInput } from "@/lib/engine/types";

const item = (placeId: string, name: string, sortOrder: number, startMin: number | null, extra: Partial<{ arriveDetail: string; arriveMinutes: number; reason: string }> = {}) => ({
  placeId, name, sortOrder, startMin, durationMin: 60, locked: false, reason: extra.reason ?? null, reasonTerms: [],
  arriveMode: null, arriveMinutes: extra.arriveMinutes ?? null, arriveDetail: extra.arriveDetail ?? null,
});
const city = (cityId: string, name: string, nights: number, sortOrder: number) => ({ cityId, name, tier: "deep" as const, nights, sortOrder, budgetBand: null, reason: null, arriveDate: null, departDate: null });
const place = (id: string, more: Partial<PlaceInput>) => ({ id, nearestStation: null, stationWalkMin: null, opensAt: null, closesAt: null, crowdNote: null, localTip: null, ...more }) as PlaceInput;

const state = {
  cities: [city("kyoto-city", "Kyoto", 2, 1), city("osaka-city", "Osaka", 1, 0)],
  days: [
    { date: "2026-11-21", cityId: "kyoto-city", items: [
      item("kyt-kodaiji", "Kodai-ji", 1, 600, { arriveDetail: "Walk", arriveMinutes: 12 }),
      item("kyt-kiyomizu", "Kiyomizu-dera", 0, 420, { arriveDetail: "From the hotel", reason: "quiet at opening" }),
    ] },
  ],
};
const dayList: [string, { cityName: string }][] = [["2026-11-20", { cityName: "Osaka" }], ["2026-11-21", { cityName: "Kyoto" }], ["2026-11-22", { cityName: "Kyoto" }]];
const bookings: DocBooking[] = [
  { id: "b1", type: "accommodation", title: "Hotel Kanra", startsAt: "2026-11-21T15:00:00Z", endsAt: "2026-11-23T10:00:00Z", plannedOn: "2026-11-21" },
  { id: "b2", type: "activity", title: "Tea ceremony", startsAt: "2026-11-21T09:00:00Z", endsAt: "2026-11-21T10:00:00Z", plannedOn: "2026-11-21" },
  { id: "b3", type: "restaurant", title: "Dinner, not in the plan", startsAt: "2026-11-20T19:00:00Z", endsAt: null, plannedOn: null },
  { id: "b4", type: "other", title: "Pass, no date", startsAt: null, endsAt: null, plannedOn: null },
];
const places = new Map([
  ["kyt-kiyomizu", place("kyt-kiyomizu", { nearestStation: "kiyomizu-gojo", stationWalkMin: 15, opensAt: "06:00", closesAt: "18:00", crowdNote: "Quiet before 08:00", localTip: "Take the back slope down" })],
  ["kyt-kodaiji", place("kyt-kodaiji", { nearestStation: "no-such-station", stationWalkMin: 10 })],
]);
const stations = new Map([["kiyomizu-gojo", { name: "Kiyomizu-Gojo" }]]);

describe("planDocument", () => {
  const doc = planDocument(state, dayList, bookings, places, stations);

  it("has every day of the trip in order, planned or not", () => {
    expect(doc.days.map((d) => [d.number, d.date, d.city, d.entries.length])).toEqual([[1, "2026-11-20", "Osaka", 0], [2, "2026-11-21", "Kyoto", 4], [3, "2026-11-22", "Kyoto", 1]]);
    expect(doc.route).toEqual([{ city: "Osaka", nights: 1 }, { city: "Kyoto", nights: 2 }]);
  });

  it("merges a day's bookings and stops by the clock, stops in their own order", () => {
    expect(doc.days[1].entries.map((e) => `${e.time} ${e.kind === "stop" ? e.name : e.title}`)).toEqual([
      "07:00 Kiyomizu-dera", "09:00 Tea ceremony", "10:00 Kodai-ji", "15:00 Hotel Kanra",
    ]);
  });

  it("shows a stay on each day it covers, and only bookings in the plan", () => {
    const middle = doc.days[2].entries;
    expect(middle).toEqual([{ kind: "booking", time: null, end: null, title: "Hotel Kanra", type: "accommodation", part: "all-day" }]);
    expect(JSON.stringify(doc.days)).not.toContain("Dinner, not in the plan");
  });

  it("gives a stop its station by name, hours, notes and how to get there (not for the first stop)", () => {
    const [first, , second] = doc.days[1].entries;
    expect(first).toMatchObject({ kind: "stop", getThere: null, station: "Kiyomizu-Gojo", stationWalkMin: 15, hours: { opens: "06:00", closes: "18:00" }, crowdNote: "Quiet before 08:00", tip: "Take the back slope down", why: "quiet at opening", end: "08:00" });
    expect(second).toMatchObject({ kind: "stop", getThere: "Walk", getThereMin: 12, station: null, stationWalkMin: null });
  });

  it("keeps a same-day booking's end time", () => {
    expect(doc.days[1].entries[1]).toMatchObject({ kind: "booking", title: "Tea ceremony", time: "09:00", end: "10:00" });
  });

  it("lists every booking, dated ones first, with its times, and never a reference", () => {
    expect(doc.bookings.find((b) => b.title === "Hotel Kanra")).toMatchObject({ startTime: "15:00", endTime: "10:00" });
    expect(doc.bookings.find((b) => b.title === "Pass, no date")).toMatchObject({ startTime: null, endTime: null });
    expect(doc.bookings.map((b) => [b.title, b.first, b.last])).toEqual([
      ["Dinner, not in the plan", "2026-11-20", "2026-11-20"],
      ["Hotel Kanra", "2026-11-21", "2026-11-23"],
      ["Tea ceremony", "2026-11-21", "2026-11-21"],
      ["Pass, no date", null, null],
    ]);
    expect(JSON.stringify(doc)).not.toMatch(/reference/i);
  });
});
