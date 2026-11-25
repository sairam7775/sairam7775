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
import { copy } from "@/copy";
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

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** The plan's free-text stops as the traveller saved them: a fixed
 *  interval at the saved time and length, never moved; no reason of
 *  Bento's (it chose nothing); pinned only if they pinned it. The planner
 *  moves a pin the day reaches late to when it gets there, and may order
 *  two of them either way; a free-text stop goes back to its own time, and
 *  the day is put back in time order. The planner's "the day only reaches
 *  it by …" described the order it made, so what runs into the stop is
 *  said again from the final order: the stop before running into it (the
 *  re-timer's "… is pinned at 19:00 but the previous stop runs until …"),
 *  or the day starting after it ("… is pinned for 19:00 but the day only
 *  reaches it by 20:00"). */
export function restoreCustomStops(plan: DayPlan, items: ItemRow[]): DayPlan {
  const saved = new Map(items.filter((i) => isCustomStop(i.placeId)).map((i) => [i.placeId, i]));
  const timed: { name: string; at: number }[] = [];
  for (const it of plan.items) {
    const s = saved.get(it.placeId);
    if (!s) continue;
    it.reason = "";
    it.reasonTerms = [];
    it.locked = s.locked;
    if (s.startMin == null) continue;
    it.startMin = s.startMin;
    it.endMin = s.startMin + it.durationMin;
    timed.push({ name: it.name, at: s.startMin });
  }
  if (!timed.length) return plan;
  // Stable: stops at the same minute keep the planner's order.
  plan.items = plan.items.map((it, k) => ({ it, k })).sort((a, b) => a.it.startMin - b.it.startMin || a.k - b.k).map((x) => x.it);
  const lateLines = timed.map((t) => copy.plan.warnings.pinnedLate(t.name, clock(t.at), "\u0000").split("\u0000")[0]);
  plan.warnings = plan.warnings.filter((w) => !lateLines.some((l) => w.startsWith(l)));
  plan.items.forEach((it, k) => {
    if (!saved.get(it.placeId) || saved.get(it.placeId)!.startMin == null) return;
    const prev = plan.items[k - 1];
    if (prev && prev.endMin > it.startMin) {
      plan.warnings.push(copy.plan.warnings.pinnedShort(it.name, clock(it.startMin), clock(prev.endMin), prev.endMin - it.startMin));
    } else if (!prev && plan.startMin > it.startMin) {
      plan.warnings.push(copy.plan.warnings.pinnedLate(it.name, clock(it.startMin), clock(plan.startMin)));
    }
  });
  return plan;
}
