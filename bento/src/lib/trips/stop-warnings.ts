/** What's off about the selected day as saved, for the day box: each stop
 *  checked again on every render by `savedDayProblems` (engine/fit.ts), so
 *  a stop the traveller added anyway still says why it doesn't fit after
 *  the sheet closes or the page reloads. Nothing is stored. Places come
 *  through `places_public`, tickets through `match.ts`, as the planner
 *  reads them. Server only. */
import { savedDayProblems } from "@/lib/engine/fit";
import { bookedPlaceIds } from "@/lib/vault/match";
import { travellerFor } from "@/lib/bento-man/tools";
import { isCustomStop } from "@/lib/bento-man/custom-stop";
import type { TripState, TripStore } from "@/lib/bento-man/store";

/** Each stop's problems by its key on the day; stops with none are left out. */
export async function savedStopWarnings(store: TripStore, state: TripState, date: string | null): Promise<Map<string, string[]>> {
  const day = date ? state.days.find((d) => d.date === date) : undefined;
  if (!day?.cityId || !day.items.length) return new Map();
  const [places, bookings] = await Promise.all([store.places(day.cityId), store.bookings()]);
  const byId = new Map(places.map((p) => [p.id, p]));
  const items = [...day.items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({
    placeId: i.placeId, startMin: i.startMin, durationMin: i.durationMin, unchecked: isCustomStop(i.placeId),
  }));
  const onDay = items.map((i) => byId.get(i.placeId)).filter((p) => p != null);
  const problems = savedDayProblems({
    date: day.date,
    items,
    places: byId,
    traveller: travellerFor(state.prefs, state.cities.find((c) => c.cityId === day.cityId)?.budgetBand ?? null),
    bookedPlaceIds: bookedPlaceIds(bookings, onDay, day.date),
  });
  return new Map(items.map((it, k) => [it.placeId, problems[k]] as const).filter(([, p]) => p.length > 0));
}
