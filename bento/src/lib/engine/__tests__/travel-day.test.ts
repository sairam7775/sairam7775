import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { DAY_BUDGET_MINUTES } from "@/lib/types";
import { copy } from "@/copy";
import { assessRoute, hubFor, type CityFacts } from "../route";
import { planDay } from "../schedule";
import { planTrip } from "../trip";
import { travelFromGraph } from "../travel";
import { cityTrainMinutes, MOVE_ALLOWANCE_MIN, travelDayOrigins, travelMove, UNKNOWN_TRAIN_MIN } from "../travel-day";
import type { PlaceInput } from "../types";
import { owner } from "../__fixtures__/kyoto";

const graph = buildGraph(stations, edges);
const travel = travelFromGraph(graph);
const placesByCity: Record<string, PlaceInput[]> = {};
for (const p of placeSeeds.flatMap((s) => s.places)) (placesByCity[p.city] ??= []).push(seedToPlaceInput(p));
const trainMinutes = cityTrainMinutes(graph);
// The owner rises early (crowd tolerance 0.15): the usual start is 07:00.
const USUAL_START = 7 * 60;
const FULL = DAY_BUDGET_MINUTES[owner.pace];

describe("travelDayOrigins", () => {
  it("marks the arrival date of every stay after the first with the stay before it, and nothing else", () => {
    const route = [
      { cityId: "osaka-city", nights: 2 },
      { cityId: "kyoto-city", nights: 2 },
      { cityId: "nara-city", nights: 0 },
      { cityId: "hiroshima-city", nights: 1 },
    ];
    const origins = travelDayOrigins("2026-11-24", route, "2026-11-29");
    // Not the first day (arriving in Japan is another question), and the
    // day trip to Nara has no date of its own: it is not a move.
    expect([...origins]).toEqual([["2026-11-26", "osaka-city"], ["2026-11-28", "kyoto-city"]]);
  });

  it("has no travel days without a start date, or with one stay", () => {
    expect(travelDayOrigins(null, [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 2 }]).size).toBe(0);
    expect(travelDayOrigins("2026-11-24", [{ cityId: "kyoto-city", nights: 3 }, { cityId: "nara-city", nights: 0 }]).size).toBe(0);
  });
});

describe("cityTrainMinutes", () => {
  it("is the hub-to-hub train a route leg shows", () => {
    const facts = new Map<string, CityFacts>(["osaka-city", "kyoto-city"].map((id) => [id, { id, name: id, tier: "deep", verifiedPlaces: 1, transitNote: null, hubStation: hubFor(id, graph) }]));
    const a = assessRoute([{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 2 }], facts, graph);
    expect(trainMinutes("osaka-city", "kyoto-city")).toBe(a.legs[0].minutes);
    expect(trainMinutes("osaka-city", "nowhere")).toBeNull();
  });
});

describe("planDay on a travel day", () => {
  const day = (move?: ReturnType<typeof travelMove>) =>
    planDay({ date: "2026-11-25", cityId: "kyoto-city", places: placesByCity["kyoto-city"], traveller: owner, travel, move });

  it("starts after the move and holds that much less time", () => {
    const train = trainMinutes("osaka-city", "kyoto-city")!;
    const move = travelMove("osaka-city", train);
    expect(move.minutes).toBe(MOVE_ALLOWANCE_MIN + train);
    const usual = day();
    const moved = day(move);
    expect(usual.budgetMin).toBe(FULL);
    expect(moved.budgetMin).toBe(FULL - move.minutes);
    expect(moved.items[0].startMin).toBeGreaterThanOrEqual(USUAL_START + move.minutes);
    expect(moved.activeMin).toBeLessThan(usual.activeMin);
    expect(moved.items.length).toBeLessThanOrEqual(usual.items.length);
    // A known train needs no warning.
    expect(moved.warnings.some((w) => w === copy.plan.warnings.moveUnknown(UNKNOWN_TRAIN_MIN + MOVE_ALLOWANCE_MIN))).toBe(false);
  });

  it("allows a cautious time for a move with no known train, and says so", () => {
    const move = travelMove("somewhere", null);
    expect(move.minutes).toBe(MOVE_ALLOWANCE_MIN + UNKNOWN_TRAIN_MIN);
    const moved = day(move);
    expect(moved.budgetMin).toBe(FULL - move.minutes);
    expect(moved.warnings).toContain(copy.plan.warnings.moveUnknown(move.minutes));
  });
});

describe("planTrip with travel days", () => {
  // Osaka 2 nights, Kyoto 2 with a Nara day trip, as a ready-made trip lays it out.
  const days = [
    { date: "2026-11-24", cityId: "osaka-city" },
    { date: "2026-11-25", cityId: "osaka-city" },
    { date: "2026-11-26", cityId: "kyoto-city", movingFrom: "osaka-city" },
    { date: "2026-11-27", cityId: "nara-city" },
    { date: "2026-11-28", cityId: "kyoto-city" },
  ];
  const plan = planTrip({ days, traveller: owner, budgetByCity: {}, placesByCity, travel, trainMinutes });
  const move = MOVE_ALLOWANCE_MIN + trainMinutes("osaka-city", "kyoto-city")!;

  it("starts the travel day after the move", () => {
    expect(plan.days[2].budgetMin).toBe(FULL - move);
    expect(plan.days[2].items[0].startMin).toBeGreaterThanOrEqual(USUAL_START + move);
  });

  it("leaves the first day, the other days and the day trip at the usual start and length", () => {
    for (const i of [0, 1, 3, 4]) expect(plan.days[i].budgetMin, days[i].date).toBe(FULL);
    // The days before the move are planned exactly as without it.
    const still = planTrip({ days: days.map((d) => ({ date: d.date, cityId: d.cityId })), traveller: owner, budgetByCity: {}, placesByCity, travel, trainMinutes });
    expect(still.days.slice(0, 2)).toEqual(plan.days.slice(0, 2));
    expect(still.days[2].budgetMin).toBe(FULL);
    // The Nara day trip starts at the usual time: no stop waits for the move.
    expect(plan.days[3].items[0].startMin).toBeLessThan(USUAL_START + move);
  });

  it("does nothing for a day whose city is where the traveller already slept", () => {
    const same = planTrip({ days: [{ date: "2026-11-24", cityId: "kyoto-city", movingFrom: "kyoto-city" }], traveller: owner, budgetByCity: {}, placesByCity, travel, trainMinutes });
    expect(same.days[0].budgetMin).toBe(FULL);
  });
});
