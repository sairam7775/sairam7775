import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store.memory";
import { buildTripView, dayCoverage, travelMoveLine, tripMoves, tripTravelDays } from "../trip-view";
import { cityTrainMinutes, travelMove } from "@/lib/engine/travel-day";
import { copy } from "@/copy";
import { planDocument } from "@/lib/trips/plan-document";
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

  it("gives each travel day its move, worked out as the planner does, and the box measures it against the shorter day", async () => {
    const store = new MemoryStore({
      trip: { startDate: "2026-11-20", endDate: "2026-11-25" }, prefs: { pace: "relaxed" },
      cities: [{ cityId: "kyoto-city", nights: 3 }, { cityId: "hiroshima-city", nights: 2 }],
      days: [
        { date: "2026-11-22", cityId: "kyoto-city", items: [item({ startMin: 600, durationMin: 300 })] },
        { date: "2026-11-23", cityId: "hiroshima-city", items: [item({ startMin: 700, durationMin: 300 })] },
      ],
    });
    const state = await store.state();
    const moves = await tripMoves(store, state);
    const expected = travelMove("kyoto-city", cityTrainMinutes(await store.graph())("kyoto-city", "hiroshima-city"));
    expect([...moves]).toEqual([["2026-11-23", expected]]);
    const view = buildTripView(state, "2026-11-23", moves);
    expect(view.stats?.budgetMin).toBe(360 - expected.minutes);
    expect(view.statsByDate.get("2026-11-22")?.budgetMin).toBe(360);
    // Without the moves (they couldn't be read), the whole day, as before.
    expect(buildTripView(state, "2026-11-23").stats?.budgetMin).toBe(360);
  });

  it("says the move the plan allows, to five minutes, and gives no figure for a guessed train", () => {
    expect(travelMoveLine(travelMove("osaka-city", 13), "Osaka")).toBe(copy.trip.travelDay.move("Osaka", "1h 15m"));
    expect(travelMoveLine(travelMove("kyoto-city", 100), "Kyoto")).toBe(copy.trip.travelDay.move("Kyoto", "2h 40m"));
    // The guess is said once, by the plan's warning; the train card already
    // says Bento has no train for it.
    const guessed = travelMoveLine(travelMove("nowhere", null), "Nowhere");
    expect(guessed).toBe(copy.trip.travelDay.moveUnknown("Nowhere"));
    expect(guessed).not.toMatch(/\d/);
  });

  it("measures a travel day saved under a city the route no longer arrives at as a whole day", async () => {
    const store = new MemoryStore({
      trip: { startDate: "2026-11-20", endDate: "2026-11-25" }, prefs: { pace: "relaxed" },
      cities: [{ cityId: "osaka-city", nights: 1 }, { cityId: "kyoto-city", nights: 2 }, { cityId: "hiroshima-city", nights: 2 }],
      // The 21st is Kyoto's arrival date, but this day was saved for
      // Hiroshima, another stay, before the route changed.
      days: [{ date: "2026-11-21", cityId: "hiroshima-city", items: [item({ startMin: 600, durationMin: 300 })] }],
    });
    const moves = await tripMoves(store, await store.state());
    expect(moves.has("2026-11-21")).toBe(false);
    expect(moves.has("2026-11-23")).toBe(true);
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
    // A day trip off the accepted route is named and covered as its own city.
    expect(view.selectedMeta).toEqual({ cityId: "nara-city", cityName: "Nara", tier: "deep" });
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

// A day trip is often to a city that isn't on the route (Miyajima from
// Hiroshima): its box says how well Bento knows that city, not "not covered".
describe("a saved day's coverage comes from its own city", () => {
  const nov = { startDate: "2026-11-20", endDate: "2026-11-29" };
  const route = [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }];
  const at = async (date: string, cityId: string, stops = 1) => {
    const state = await new MemoryStore({ trip: nov, cities: route, days: [{ date, cityId, items: Array.from({ length: stops }, (_, i) => item({ placeId: `p${i}`, sortOrder: i })) }] }).state();
    const view = buildTripView(state, date);
    return { meta: view.selectedMeta!, box: dayCoverage(view.selectedMeta!, view.selectedDay?.items.length ?? 0), chip: view.dayList.find(([d]) => d === date)![1].cityName };
  };

  it("a Miyajima day trip reads as main sights, offers Re-plan and carries the line", async () => {
    const { meta, box, chip } = await at("2026-11-28", "miyajima");
    expect(chip).toBe("Miyajima");
    expect(meta).toEqual({ cityId: "miyajima", cityName: "Miyajima", tier: "outline" });
    expect(box).toEqual({ words: copy.coverage.outline, editable: true, uncovered: false, mainSights: true });
  });

  it("a Nara day trip reads as well covered, offers Re-plan and has no line", async () => {
    const { box, chip } = await at("2026-11-24", "nara-city");
    expect(chip).toBe("Nara");
    expect(box).toEqual({ words: copy.coverage.deep, editable: true, uncovered: false, mainSights: false });
  });

  it("a day trip to a city Bento doesn't cover stays uncovered, as before", async () => {
    const { box, chip } = await at("2026-11-24", "takayama");
    expect(chip).toBe("Takayama");
    expect(box).toEqual({ words: copy.coverage.stub, editable: false, uncovered: true, mainSights: false });
  });

  it("days on the route are unchanged", async () => {
    expect((await at("2026-11-23", "kyoto-city")).box).toEqual({ words: copy.coverage.deep, editable: true, uncovered: false, mainSights: false });
    const view = buildTripView(await new MemoryStore({ trip: nov, cities: route }).state(), "2026-11-23");
    expect(view.selectedMeta).toEqual({ cityId: "kyoto-city", cityName: "Kyoto", tier: "deep" });
    expect(dayCoverage(view.selectedMeta!, 0)).toEqual({ words: copy.coverage.deep, editable: true, uncovered: false, mainSights: false });
  });

  it("the download names the day trip's city and carries the line, from the same view", async () => {
    const state = await new MemoryStore({ trip: nov, cities: route, days: [{ date: "2026-11-28", cityId: "miyajima", items: [item({})] }] }).state();
    const day = planDocument(state, buildTripView(state, null).dayList, [], new Map(), new Map()).days.find((d) => d.date === "2026-11-28")!;
    expect(day).toMatchObject({ city: "Miyajima", mainSights: true });
  });

  it("a main-sights day with no stops yet has no line", async () => {
    expect((await at("2026-11-28", "miyajima", 0)).box.mainSights).toBe(false);
  });
});
