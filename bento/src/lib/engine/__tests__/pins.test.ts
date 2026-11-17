import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { kyoto as kyotoSeed } from "@/lib/places/seed/kyoto";
import { hiroshima as hiroshimaSeed } from "@/lib/places/seed/hiroshima";
import { tokyo as tokyoSeed } from "@/lib/places/seed/tokyo";
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

/** Timing warnings ("opens at", "pinned for") that name a place the day
 *  doesn't hold. (A name inside the name of a place the day does hold
 *  doesn't count.) The "has no station" warnings are left out on purpose:
 *  they still name places growth only looked at, a known gap whose fix
 *  changes plan_days' result and so waits for a live eval. */
const absentNamed = (plan: ReturnType<typeof planDay>, places: PlaceInput[]) => {
  const inDay = places.filter((p) => plan.items.some((i) => i.placeId === p.id));
  return plan.warnings.filter((w) => /opens at|is pinned for/.test(w)).filter((w) =>
    places.some((p) => !inDay.includes(p) && w.includes(p.name) && !inDay.some((q) => q.name.includes(p.name) && w.includes(q.name))),
  );
};

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
    // The kagura may stay, but only after the pins that close before it opens.
    const order = plan.items.map((i) => i.placeId);
    if (order.includes("hir-kagura"))
      for (const id of ["hir-shukkeien", "hir-castle"]) expect(order.indexOf("hir-kagura"), id).toBeGreaterThan(order.indexOf(id));
    expect(pinDrops(plan)).toEqual([]);
  });

  it("doesn't choose a stop that would make a pin late, rather than choosing and dropping it", () => {
    // Meiji Jingu closes at 16:00 (its shortest hours). On a packed day the
    // planner used to fill the morning in front of it, then drop stops again
    // to reach it in time.
    const tokyo = tokyoSeed.map((s) => seedToPlaceInput(s));
    for (const date of ["2027-05-11", "2027-05-12", "2027-05-13", "2027-05-14", "2027-05-15", "2027-05-16", "2027-05-17"]) {
      const plan = planDay({ date, cityId: "tokyo-city", places: tokyo, travel, traveller, locked: [{ placeId: "tky-meiji-jingu" }] });
      const meiji = plan.items.find((i) => i.placeId === "tky-meiji-jingu")!;
      expect(meiji.endMin, date).toBeLessThanOrEqual(16 * 60);
      expect(pinDrops(plan), date).toEqual([]);
      expect(plan.items.length, date).toBeGreaterThan(3);
    }
  });

  it("warns only about the day it returns, not the ones it tried", () => {
    // replan_day and plan_days re-pin saved stops at their times. Every place
    // tried in front of the 15:30 garden used to leave "pinned for 15:30 but
    // the day only reaches it by …" behind, and "… opens at …" for places
    // that never made the day.
    for (const pace of ["relaxed", "standard", "packed"] as const) {
      const plan = planDay({
        date: "2027-05-19", cityId: "hiroshima-city", places: hiroshima, travel,
        traveller: { ...traveller, pace },
        locked: [{ placeId: "hir-shukkeien", startMin: 15 * 60 + 30 }],
      });
      expect(plan.items.find((i) => i.placeId === "hir-shukkeien")!.startMin, pace).toBe(15 * 60 + 30);
      expect(plan.warnings.filter((w) => /pinned for/.test(w)), pace).toEqual([]);
      expect(absentNamed(plan, hiroshima), pace).toEqual([]);
    }
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
    // it. X opens at noon and, put before B (closes 13:30), would hold B
    // until after closing. A being late must not stop the planner from
    // keeping B in its hours: X goes after B, or not at all.
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
    const order = plan.items.map((i) => i.placeId);
    if (order.includes("x")) expect(order.indexOf("x")).toBeGreaterThan(order.indexOf("b"));
    else expect(plan.considered.find((r) => r.placeId === "x")?.detail).toBe(copy.plan.leftOut.makesPinLate("B"));
  });
});
