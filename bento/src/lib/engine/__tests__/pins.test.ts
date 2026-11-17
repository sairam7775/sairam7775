import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { kyoto as kyotoSeed } from "@/lib/places/seed/kyoto";
import { hiroshima as hiroshimaSeed } from "@/lib/places/seed/hiroshima";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { copy } from "@/copy";
import { parseClock } from "../filter";
import { planDay } from "../schedule";
import { planTrip } from "../trip";
import { travelFromGraph } from "../travel";
import type { PlaceInput, TravelFn } from "../types";

/** Pins: what a ready-made trip's must-see places (and a traveller's own
 *  pins) rely on. */
const travel = travelFromGraph(buildGraph(stations, edges));
const kyoto = kyotoSeed.map((s) => seedToPlaceInput(s));
const hiroshima = hiroshimaSeed.map((s) => seedToPlaceInput(s));
const traveller = { pace: "packed" as const, interestTags: [], energy: 0.5, crowdTolerance: 0.6, discovery: 0.5, excludes: [], mobility: [], budgetBand: null };

/** Dropped to make room for a pin, as opposed to dropped for its own hours. */
const pinDrops = (plan: ReturnType<typeof planDay>) =>
  plan.considered.filter((r) => r.stage === "validate" && /leave time to reach/.test(r.detail));

describe("planTrip and pins", () => {
  it("leaves a place pinned on a later day for that day", () => {
    // Three places and a packed first day: unpinned, the first day takes
    // all three, so the day Kiyomizu-dera is pinned to would find it gone.
    const three = kyoto.filter((p) => ["kyt-kiyomizu", "kyt-ninenzaka", "kyt-gion"].includes(p.id));
    const plan = planTrip({
      days: [
        { date: "2026-11-24", cityId: "kyoto-city" },
        { date: "2026-11-25", cityId: "kyoto-city", locked: [{ placeId: "kyt-kiyomizu" }] },
      ],
      traveller,
      budgetByCity: {},
      placesByCity: { "kyoto-city": three },
      travel,
    });
    expect(plan.days[0].items.map((i) => i.placeId).sort()).toEqual(["kyt-gion", "kyt-ninenzaka"]);
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
    expect(plan.items.map((i) => i.placeId)).not.toContain("hir-kagura");
    expect(plan.considered.find((r) => r.placeId === "hir-kagura")).toMatchObject({
      stage: "validate", detail: copy.plan.leftOut.makesPinLate("Hiroshima Castle"),
    });
  });

  it("keeps its stops when a pin is late because of its own fixed time", () => {
    // replan_day and plan_days re-pin saved stops at their saved times. A
    // garden pinned at 16:30 overruns its 17:00 closing whatever comes
    // before it, so nothing before it may be dropped for it.
    const plan = planDay({
      date: "2027-05-19", cityId: "hiroshima-city", places: hiroshima, travel,
      traveller: { ...traveller, pace: "standard" },
      locked: [{ placeId: "hir-shukkeien", startMin: 16 * 60 + 30 }],
    });
    expect(pinDrops(plan)).toEqual([]);
    const pin = plan.items.findIndex((i) => i.placeId === "hir-shukkeien");
    expect(pin).toBeGreaterThanOrEqual(2);
  });

  it("looks past a late pin it can't help to one it can", () => {
    // A is pinned at 09:00 and overruns its 09:30 closing: nothing can help
    // it. X, chosen by the planner, opens at noon and holds B (closes 13:30)
    // until after closing; dropping X is what helps B.
    const base: PlaceInput = {
      id: "", cityId: "test-city", name: "", category: "temple", interestTags: [], energy: 0.3, crowdLevel: 0.3,
      discovery: 0.5, signature: 0.9, physicalDemand: null, durationTasteMin: 60, durationTypicalMin: 60,
      durationFullMin: 60, bestWindow: [], skipIf: [], worthItIf: [], costJpy: 0, bookingReq: "none",
      bookingLeadDays: null, opensAt: null, closesAt: null, closedWeekdays: [], closedDates: [], conflictsWith: [],
      pairsWith: [], verificationStatus: "verified", coverageTier: "deep", nearestStation: "s", stationWalkMin: 0,
    };
    const places: PlaceInput[] = [
      { ...base, id: "a", name: "A", opensAt: "09:00", closesAt: "09:30" },
      { ...base, id: "b", name: "B", category: "garden", opensAt: "09:00", closesAt: "13:30" },
      { ...base, id: "x", name: "X", category: "museum", opensAt: "12:00", closesAt: "18:00" },
    ];
    const tenMinutes: TravelFn = () => ({ mode: "walk", minutes: 10, fareJpy: 0, fareKind: "exact", detail: "", lines: [] });
    const plan = planDay({
      date: "2027-05-19", cityId: "test-city", places, travel: tenMinutes, traveller,
      locked: [{ placeId: "a", startMin: 9 * 60 }, { placeId: "b" }],
    });
    const b = plan.items.find((i) => i.placeId === "b")!;
    expect(b.endMin).toBeLessThanOrEqual(13 * 60 + 30);
    expect(plan.considered.find((r) => r.placeId === "x")).toMatchObject({ stage: "validate", detail: copy.plan.leftOut.makesPinLate("B") });
  });
});
