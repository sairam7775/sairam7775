/** A traveller's own free-text stop (0036) through a re-plan: kept at its
 *  saved time and length as a fixed block, like a pin, and never removed
 *  (owner decision, 25 Nov 2026). The planner knows nothing about it, so it
 *  gets a stand-in place with nothing to score or check: no hours, no
 *  position, no station. Its legs are the re-timer's guess (`uncheckedLeg`,
 *  "Travel time unknown — the day allows 45 min"), the same as the day box
 *  shows. `replanDay` and `plan_days` both use this, so neither drops one. */
import type { CoverageTier } from "@/lib/types";
import type { DayPlan, LockedItem, PlaceInput, TravelFn } from "@/lib/engine/types";
import { uncheckedLeg } from "@/lib/engine/retime";
import { isCustomStop } from "./custom-stop";
import type { ItemRow } from "./store";

const FALLBACK_LENGTH_MIN = 60;

/** The day's free-text stops as stand-in places, pinned at their saved
 *  times (an untimed one is slotted where the clock reaches it). */
export function customStopsForPlan(items: ItemRow[], cityId: string, tier: CoverageTier): { places: PlaceInput[]; locked: LockedItem[] } {
  const customs = items.filter((i) => isCustomStop(i.placeId));
  return {
    places: customs.map((i) => standIn(i, cityId, tier)),
    locked: customs.map((i) => ({ placeId: i.placeId, startMin: i.startMin })),
  };
}

function standIn(i: ItemRow, cityId: string, tier: CoverageTier): PlaceInput {
  const length = i.durationMin ?? FALLBACK_LENGTH_MIN;
  return {
    id: i.placeId,
    cityId,
    name: i.customName ?? i.name,
    // Its own category, so two of them never read as "your second … today".
    category: i.placeId,
    interestTags: [],
    energy: null,
    crowdLevel: null,
    discovery: null,
    signature: 0,
    physicalDemand: null,
    durationTasteMin: length,
    durationTypicalMin: length,
    durationFullMin: length,
    bestWindow: [],
    skipIf: [],
    worthItIf: [],
    costJpy: null,
    bookingReq: "none",
    bookingLeadDays: null,
    opensAt: null,
    closesAt: null,
    closedWeekdays: [],
    closedDates: [],
    conflictsWith: [],
    pairsWith: [],
    // Not a claim about the place: the traveller chose it, so no rule of
    // Bento's may leave it out.
    verificationStatus: "verified",
    coverageTier: tier,
    nearestStation: null,
    stationWalkMin: null,
  };
}

/** Travel with a free-text stop at either end is the re-timer's guess. */
export function aroundCustomStops(travel: TravelFn): TravelFn {
  return (a, b) => (isCustomStop(a.id) || isCustomStop(b.id) ? uncheckedLeg() : travel(a, b));
}

/** The plan's free-text stops as the traveller saved them: no reason of
 *  Bento's (it chose nothing) and pinned only if they pinned it. */
export function restoreCustomStops(plan: DayPlan, items: ItemRow[]): DayPlan {
  const saved = new Map(items.filter((i) => isCustomStop(i.placeId)).map((i) => [i.placeId, i]));
  for (const it of plan.items) {
    const s = saved.get(it.placeId);
    if (!s) continue;
    it.reason = "";
    it.reasonTerms = [];
    it.locked = s.locked;
  }
  return plan;
}
