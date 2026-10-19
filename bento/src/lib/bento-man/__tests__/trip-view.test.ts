import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store.memory";
import { buildTripView, tripTravelDays } from "../trip-view";
import type { ItemRow } from "../store";

const trip = { startDate: "2026-11-20", endDate: "2026-11-23" };
const item = (patch: Partial<ItemRow>): ItemRow => ({
  placeId: "stop", name: "Stop", sortOrder: 0, startMin: null,
  durationMin: null, locked: false, reason: null, reasonTerms: [],
  arriveMode: null, arriveMinutes: null, arriveDetail: null, ...patch,
});

describe("a pending proposal in a test history", () => {
  it("shows in the trip state as waiting for an answer", async () => {
    const store = new MemoryStore({
      trip,
      history: [
        { role: "user", content: "Kyoto for three nights." },
        { role: "assistant", content: "Here it is.", proposal: { summary: "Kyoto, 3 nights", days: [] }, status: "proposed" },
      ],
    });
    expect((await store.state()).pendingProposal?.summary).toBe("Kyoto, 3 nights");
  });
});

describe("tripTravelDays", () => {
  it("gives each travel day the trains of that move, from the accepted route", async () => {
    const store = new MemoryStore({ trip: { startDate: "2026-11-20", endDate: "2026-11-25" }, cities: [{ cityId: "kyoto-city", nights: 3 }, { cityId: "hiroshima-city", nights: 2 }] });
    const days = await tripTravelDays(store, await store.state());
    expect([...days.keys()]).toEqual(["2026-11-23"]);
    expect(days.get("2026-11-23")?.[0].summary).toMatch(/Kyoto → Hiroshima/);
  });

  it("has no travel days with one stop", async () => {
    const store = new MemoryStore({ trip, cities: [{ cityId: "kyoto-city", nights: 3 }] });
    expect((await tripTravelDays(store, await store.state())).size).toBe(0);
  });
});

describe("buildTripView", () => {
  it("sorts the accepted route, includes unplanned dates and falls back to the first day", async () => {
    const state = await new MemoryStore({ trip, cities: [{ cityId: "kyoto-city", nights: 2 }, { cityId: "osaka-city", nights: 1 }] }).state();
    state.cities.reverse();
    const original = structuredClone(state);
    const view = buildTripView(state, "2026-12-01");
    expect(view.dayList.map(([date, meta]) => [date, meta.cityName])).toEqual([
      ["2026-11-20", "Kyoto"], ["2026-11-21", "Kyoto"],
      ["2026-11-22", "Osaka"], ["2026-11-23", "Osaka"],
    ]);
    expect(view.selected).toBe("2026-11-20");
    expect(view.selectedDay).toBeUndefined();
    expect(view.stats).toBeNull();
    expect(state).toEqual(original);
  });

  it("keeps a stored day trip's city and shares its stored timing statistics", async () => {
    const state = await new MemoryStore({
      trip, prefs: { pace: "relaxed" }, cities: [{ cityId: "kyoto-city", nights: 3 }],
      days: [{ date: "2026-11-21", cityId: "nara-city", items: [
        item({ startMin: 600, durationMin: 90, arriveMinutes: 40, mapName: "Stop", nameJa: "停止" }),
        item({ placeId: "second", sortOrder: 1, startMin: 780, durationMin: 300, arriveMinutes: 15 }),
      ] }],
    }).state();
    const view = buildTripView(state, "2026-11-21");
    // A city absent from the accepted route keeps the page's id/stub fallback.
    expect(view.selectedMeta).toEqual({ cityId: "nara-city", cityName: "nara-city", tier: "stub" });
    expect(view.selectedDay).toBe(state.days[0]);
    expect(view.dayItems?.[0]).toMatchObject({ mapName: "Stop", nameJa: "停止" });
    expect(view.stats).toEqual({ budgetMin: 360, activeMin: 405, overBy: 45, overFromIndex: 1, lunch: { startMin: 690, endMin: 750 } });
    expect(view.stats).toBe(view.statsByDate.get("2026-11-21"));
  });

  it("keeps stored days with unknown or missing cities even without trip dates", async () => {
    const state = await new MemoryStore({ days: [
      { date: "2026-11-22", cityId: null, items: [] },
      { date: "2026-11-21", cityId: "unknown", items: [] },
    ] }).state();
    const view = buildTripView(state, "2026-11-22");
    expect(view.dayList.map(([date]) => date)).toEqual(["2026-11-21", "2026-11-22"]);
    expect(view.selectedMeta).toEqual({ cityId: null, cityName: "—", tier: "stub" });
    expect(view.stats).toMatchObject({ activeMin: 0, budgetMin: 480, lunch: null });
    const empty = buildTripView(await new MemoryStore().state(), null);
    expect(empty.dayList).toEqual([]);
    expect(empty.selected).toBeNull();
    expect(empty.selectedMeta).toBeNull();
    expect(empty.stats).toBeNull();
  });
});
