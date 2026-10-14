/** Re-time a day the traveller has rearranged by hand.
 *
 *  Drag, pin, remove are the traveller's own edits and apply at once (§08:
 *  their edits never vanish). What must not go stale is the clock: after
 *  a change, every stop's start, the leg between stops, and whether the
 *  day still fits its budget are recomputed here — by the engine, not by
 *  the UI, and not by a model. No choices are made: the order is the
 *  traveller's, the times follow from it. */
import { DAY_BUDGET_MINUTES, type TravelPace } from "@/lib/types";
import { parseClock } from "./filter";
import type { PlaceInput, TravelFn, TravelLeg } from "./types";

export interface RetimeItem {
  placeId: string;
  durationMin: number;
  locked: boolean;
  /** A time the traveller fixed. Only honoured on locked items. */
  startMin: number | null;
}

export interface RetimedItem extends RetimeItem {
  startMin: number;
  endMin: number;
  arriveBy: TravelLeg | null;
  /** Fell past the day's budget. */
  over: boolean;
}

export interface RetimedDay {
  items: RetimedItem[];
  meals: { kind: "lunch"; startMin: number; endMin: number }[];
  startMin: number;
  endMin: number;
  budgetMin: number;
  activeMin: number;
  /** Minutes past the budget, 0 when it fits. */
  overBy: number;
  warnings: string[];
}

const FALLBACK_TRAVEL_MIN = 45;
const LUNCH_MIN = 60;
const LUNCH_EARLIEST = 11 * 60 + 30;
const LUNCH_LATEST = 14 * 60;
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function retimeDay(input: {
  items: RetimeItem[];
  places: Map<string, PlaceInput>;
  travel: TravelFn;
  pace: TravelPace;
  dayStartMin: number;
}): RetimedDay {
  const budgetMin = DAY_BUDGET_MINUTES[input.pace];
  const warnings: string[] = [];
  const out: RetimedItem[] = [];
  let clockMin = input.dayStartMin;
  let activeMin = 0;
  let prev: PlaceInput | null = null;
  let lunchDone = false;
  const meals: RetimedDay["meals"] = [];

  for (const it of input.items) {
    const place = input.places.get(it.placeId);
    let leg: TravelLeg | null = null;
    if (prev && place) {
      leg = input.travel(prev, place);
      if (!leg) warnings.push(`No route on record from ${prev.name} to ${place.name} — assumed ${FALLBACK_TRAVEL_MIN} min`);
    }
    const travelMin = prev ? (leg?.minutes ?? FALLBACK_TRAVEL_MIN) : 0;
    let start = clockMin + travelMin;

    // Lunch goes in the first gap it fits, before the stop that would
    // otherwise start after the window closes.
    if (!lunchDone && start >= LUNCH_EARLIEST && start <= LUNCH_LATEST + LUNCH_MIN) {
      const lunchStart = Math.max(clockMin, LUNCH_EARLIEST);
      meals.push({ kind: "lunch", startMin: lunchStart, endMin: lunchStart + LUNCH_MIN });
      start = Math.max(start, lunchStart + LUNCH_MIN + travelMin);
      lunchDone = true;
    }

    if (it.locked && it.startMin != null) {
      if (it.startMin < start) {
        warnings.push(`${place?.name ?? it.placeId} is pinned at ${clock(it.startMin)} but the previous stop runs until ${clock(start - travelMin)} — ${start - it.startMin} min short`);
      }
      start = Math.max(start, it.startMin);
    }

    if (place?.opensAt) {
      const opens = parseClock(place.opensAt);
      if (opens != null && start < opens) {
        warnings.push(`${place.name} opens at ${place.opensAt} — ${opens - start} min wait`);
        start = opens;
      }
    }
    const end = start + it.durationMin;
    if (place?.closesAt) {
      const closes = parseClock(place.closesAt);
      if (closes != null && end > closes) warnings.push(`${place.name} closes at ${place.closesAt}; this visit runs to ${clock(end)}`);
    }

    activeMin += travelMin + it.durationMin;
    out.push({ ...it, startMin: start, endMin: end, arriveBy: leg, over: activeMin > budgetMin });
    clockMin = end;
    prev = place ?? prev;
  }

  // A day that runs past the window without a gap still eats: lunch goes
  // after the stop that spanned it.
  if (!lunchDone && clockMin >= LUNCH_EARLIEST) {
    meals.push({ kind: "lunch", startMin: clockMin, endMin: clockMin + LUNCH_MIN });
    clockMin += LUNCH_MIN;
  }

  const overBy = Math.max(0, activeMin - budgetMin);
  if (overBy) warnings.push(`${Math.floor(overBy / 60) ? `${Math.floor(overBy / 60)}h ` : ""}${overBy % 60}m over a ${budgetMin / 60}-hour day`);

  return {
    items: out,
    meals,
    startMin: input.dayStartMin,
    endMin: clockMin,
    budgetMin,
    activeMin,
    overBy,
    warnings,
  };
}
