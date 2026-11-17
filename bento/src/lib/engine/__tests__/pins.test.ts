import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { kyoto as kyotoSeed } from "@/lib/places/seed/kyoto";
import { hiroshima as hiroshimaSeed } from "@/lib/places/seed/hiroshima";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { parseClock } from "../filter";
import { planDay } from "../schedule";
import { planTrip } from "../trip";
import { travelFromGraph } from "../travel";

/** Pins against the real seeds: what a ready-made trip's must-see places
 *  (and a traveller's own pins) rely on. */
const travel = travelFromGraph(buildGraph(stations, edges));
const kyoto = kyotoSeed.map((s) => seedToPlaceInput(s));
const hiroshima = hiroshimaSeed.map((s) => seedToPlaceInput(s));
const traveller = { pace: "packed" as const, interestTags: [], energy: 0.5, crowdTolerance: 0.6, discovery: 0.5, excludes: [], mobility: [], budgetBand: null };

describe("planTrip and pins", () => {
  it("leaves a place pinned on a later day for that day", () => {
    // Kiyomizu-dera is the best-scoring place in Kyoto: unpinned, the first
    // day takes it, and the day it is pinned to says it is already planned.
    const plan = planTrip({
      days: [
        { date: "2026-11-24", cityId: "kyoto-city" },
        { date: "2026-11-25", cityId: "kyoto-city", locked: [{ placeId: "kyt-kiyomizu" }] },
      ],
      traveller,
      budgetByCity: {},
      placesByCity: { "kyoto-city": kyoto },
      travel,
    });
    expect(plan.days[0].items.map((i) => i.placeId)).not.toContain("kyt-kiyomizu");
    expect(plan.days[1].items.map((i) => i.placeId)).toContain("kyt-kiyomizu");
    expect(plan.days[1].warnings.filter((w) => /pinned/i.test(w))).toEqual([]);
  });
});

describe("planDay and pins", () => {
  it("doesn't let a stop it chose push a pinned place past closing", () => {
    // A Wednesday in Hiroshima: the evening kagura (Wednesdays only, from
    // 19:00) used to be slotted before the pins, so the castle and the
    // garden were reached after they had shut.
    const pins = ["hir-shukkeien", "hir-castle", "hir-okonomimura"];
    const plan = planDay({
      date: "2027-05-19", cityId: "hiroshima-city", places: hiroshima, travel,
      traveller: { ...traveller, pace: "standard" },
      locked: pins.map((placeId) => ({ placeId })),
    });
    for (const id of pins) {
      const item = plan.items.find((i) => i.placeId === id);
      expect(item, id).toBeDefined();
      const closes = parseClock(hiroshima.find((p) => p.id === id)!.closesAt);
      if (closes != null) expect(item!.endMin, id).toBeLessThanOrEqual(closes);
    }
    const left = plan.considered.find((r) => r.placeId === "hir-kagura");
    if (left?.stage === "validate") expect(left.detail).toMatch(/Hiroshima Castle/);
  });
});
