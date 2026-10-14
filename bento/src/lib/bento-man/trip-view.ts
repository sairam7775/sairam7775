/** Prepare the accepted itinerary for the trip page, keeping engine calls
 *  outside components. Stored days override the route's date allocation. */
import { allocateDates } from "@/lib/engine/route";
import { dayStats } from "@/lib/engine/day-stats";
import type { TripState } from "./store";

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
