/** What's off about the selected day as saved, for the day box: each stop
 *  checked again on every render by `savedDayProblems` (engine/fit.ts), so
 *  a stop the traveller added anyway still says why it doesn't fit after
 *  the sheet closes or the page reloads. Nothing is stored.
 *
 *  Two parts, so the page reads as little as it can: `stopWarningPlaces`
 *  reads only the places the day's stops refer to (through `places_public`,
 *  in the page's first round of reads), and `savedStopWarnings` works the
 *  lines out from those, the booking rows the page already has (tickets by
 *  `match.ts`) and the day's move. Server only. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { savedDayProblems } from "@/lib/engine/fit";
import { PLACE_COLUMNS, rowToPlace } from "@/lib/engine/load";
import type { PlaceInput } from "@/lib/engine/types";
import { bookedPlaceIds, type TicketLike } from "@/lib/vault/match";
import { travellerFor } from "@/lib/bento-man/tools";
import { isCustomStop } from "@/lib/bento-man/custom-stop";
import type { DayRow, TripState } from "@/lib/bento-man/store";

function dayOf(state: TripState, date: string | null): DayRow | undefined {
  const day = date ? state.days.find((d) => d.date === date) : undefined;
  return day?.cityId && day.items.length ? day : undefined;
}

/** The day's Bento places, by id; none read for a day without any. */
export async function stopWarningPlaces(db: SupabaseClient, state: TripState, date: string | null): Promise<Map<string, PlaceInput>> {
  const day = dayOf(state, date);
  const ids = [...new Set((day?.items ?? []).map((i) => i.placeId).filter((id) => !isCustomStop(id)))];
  if (!day || !ids.length) return new Map();
  const { data, error } = await db.from("places_public").select(PLACE_COLUMNS).in("id", ids);
  if (error) throw error;
  // The day's own city's tier: only "not covered" reads it, and an
  // editable day's city is covered.
  const tier = day.city?.tier ?? state.cities.find((c) => c.cityId === day.cityId)?.tier ?? "outline";
  return new Map((data ?? []).map((r) => {
    const p = rowToPlace(r, tier);
    return [p.id, p] as const;
  }));
}

/** Each stop's problems by its key on the day; stops with none are left out. */
export function savedStopWarnings(input: {
  state: TripState;
  date: string | null;
  places: Map<string, PlaceInput>;
  bookings: TicketLike[];
  moveMin?: number;
}): Map<string, string[]> {
  const day = dayOf(input.state, input.date);
  if (!day) return new Map();
  const items = [...day.items].sort((a, b) => a.sortOrder - b.sortOrder).map((i) => ({
    placeId: i.placeId, startMin: i.startMin, durationMin: i.durationMin, unchecked: isCustomStop(i.placeId),
  }));
  const onDay = items.map((i) => input.places.get(i.placeId)).filter((p) => p != null);
  const problems = savedDayProblems({
    date: day.date,
    items,
    places: input.places,
    traveller: travellerFor(input.state.prefs, input.state.cities.find((c) => c.cityId === day.cityId)?.budgetBand ?? null),
    bookedPlaceIds: bookedPlaceIds(input.bookings, onDay, day.date),
    moveMin: input.moveMin,
  });
  return new Map(items.map((it, k) => [it.placeId, problems[k]] as const).filter(([, p]) => p.length > 0));
}
