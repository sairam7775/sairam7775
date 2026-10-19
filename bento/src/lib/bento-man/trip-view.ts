/** Prepare the accepted itinerary for the trip page, keeping engine calls
 *  outside components. Stored days override the route's date allocation. */
import { allocateDates, assessRoute } from "@/lib/engine/route";
import { dayStats } from "@/lib/engine/day-stats";
import { travelDays } from "@/lib/trips/travel-days";
import type { TripState, TripStore } from "./store";

/** Each travel day's trains, from Bento's own train data, worked out again
 *  from the accepted route so they always match it. */
export async function tripTravelDays(store: Pick<TripStore, "cities" | "graph">, state: TripState) {
  const sorted = [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted.length < 2) return new Map<string, never>();
  const [facts, graph] = await Promise.all([store.cities(), store.graph()]);
  const a = assessRoute(sorted.map((c) => ({ cityId: c.cityId, nights: c.nights })), new Map(facts.map((f) => [f.id, f])), graph);
  return travelDays(sorted, a.legs);
}

export function buildTripView(state: TripState, requested: string | null) {
  const cityById = new Map(state.cities.map((c) => [c.cityId, c]));
  const dates = new Map<string, { cityId: string | null; cityName: string; tier: string }>();
  for (const c of allocateDates(state.trip.startDate, [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder), state.trip.endDate)) {
    for (const d of c.dates) dates.set(d, { cityId: c.cityId, cityName: cityById.get(c.cityId)?.name ?? c.cityId, tier: cityById.get(c.cityId)?.tier ?? "stub" });
  }
  for (const d of state.days) {
    const c = d.cityId ? cityById.get(d.cityId) : null;
    dates.set(d.date, { cityId: d.cityId, cityName: c?.name ?? d.cityId ?? "—", tier: c?.tier ?? "stub" });
  }
  const dayList = [...dates.entries()].sort(([a], [b]) => a.localeCompare(b));
  const daysByDate = new Map(state.days.map((d) => [d.date, d]));
  const statsByDate = new Map(state.days.map((d) => [d.date, dayStats(d.items, state.prefs.pace)]));
  const selected = requested && dates.has(requested) ? requested : dayList[0]?.[0] ?? null;
  const selectedDay = selected ? daysByDate.get(selected) : undefined;
  const selectedMeta = selected ? dates.get(selected)! : null;
  const stats = selectedDay ? statsByDate.get(selectedDay.date)! : null;
  return { dayList, statsByDate, selected, selectedDay, selectedMeta, stats };
}
