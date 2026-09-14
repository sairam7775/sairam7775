import { planDay } from "./schedule";
import type { DayInput, DayPlan, LockedItem, PlaceInput, TravelFn, TravellerInput } from "./types";
import type { BudgetBand } from "@/lib/types";

export interface TripDay {
  date: string;
  cityId: string;
  locked?: LockedItem[];
}

export interface TripInput {
  days: TripDay[];
  traveller: Omit<TravellerInput, "budgetBand">;
  /** D14: budget is per city, not per trip. */
  budgetByCity: Record<string, BudgetBand | null>;
  placesByCity: Record<string, PlaceInput[]>;
  travel: TravelFn;
  bookedPlaceIds?: string[];
  weights?: DayInput["weights"];
}

export interface CityTotals {
  cityId: string;
  days: number;
  placesJpy: number;
  faresJpy: number;
  costJpy: number;
  fareKind: "exact" | "estimate";
}

export interface TripPlan {
  days: DayPlan[];
  byCity: CityTotals[];
  costJpy: number;
  fareKind: "exact" | "estimate";
}

/** Plans every day in order, so a place used on Tuesday is not offered
 *  again on Thursday, and totals cost per city — a ryokan night in one
 *  city must not read as overspending in another. */
export function planTrip(input: TripInput): TripPlan {
  const used = new Set<string>();
  const days: DayPlan[] = [];

  for (const d of input.days) {
    const plan = planDay({
      date: d.date,
      cityId: d.cityId,
      places: input.placesByCity[d.cityId] ?? [],
      traveller: { ...input.traveller, budgetBand: input.budgetByCity[d.cityId] ?? null },
      travel: input.travel,
      locked: d.locked,
      bookedPlaceIds: input.bookedPlaceIds,
      usedPlaceIds: [...used],
      weights: input.weights,
    });
    for (const it of plan.items) used.add(it.placeId);
    days.push(plan);
  }

  const byCityMap = new Map<string, CityTotals>();
  for (const p of days) {
    const c = byCityMap.get(p.cityId) ?? { cityId: p.cityId, days: 0, placesJpy: 0, faresJpy: 0, costJpy: 0, fareKind: "exact" as const };
    c.days++;
    c.placesJpy += p.placesJpy;
    c.faresJpy += p.faresJpy;
    c.costJpy += p.costJpy;
    if (p.fareKind === "estimate") c.fareKind = "estimate";
    byCityMap.set(p.cityId, c);
  }
  const byCity = [...byCityMap.values()];

  return {
    days,
    byCity,
    costJpy: byCity.reduce((s, c) => s + c.costJpy, 0),
    fareKind: byCity.some((c) => c.fareKind === "estimate") ? "estimate" : "exact",
  };
}
