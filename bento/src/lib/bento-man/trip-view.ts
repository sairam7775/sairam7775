/** Prepare the accepted itinerary for the trip page, keeping engine calls
 *  outside components. Stored days override the route's date allocation. */
import { allocateDates, assessRoute } from "@/lib/engine/route";
import { dayStats } from "@/lib/engine/day-stats";
import { cityTrainMinutes, toFive, travelDayMoves } from "@/lib/engine/travel-day";
import { clock } from "./diff";
import type { TravelMove } from "@/lib/engine/types";
import { travelDays } from "@/lib/trips/travel-days";
import { showsMainSights } from "@/lib/trips/route-card";
import { copy } from "@/copy";
import type { CoverageTier } from "@/lib/types";
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

/** Each travel day's move, worked out from the accepted route the way the
 *  planner does (`travelDayMoves`), for the day box and its travel card. */
export async function tripMoves(store: Pick<TripStore, "cities" | "graph">, state: TripState): Promise<Map<string, TravelMove>> {
  const out = new Map<string, TravelMove>();
  const sorted = [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted.length < 2) return out;
  const [facts, graph] = await Promise.all([store.cities(), store.graph()]);
  const moveOn = travelDayMoves(state.trip.startDate, state.trip.endDate, sorted, cityTrainMinutes(graph, new Map(facts.map((f) => [f.id, f]))));
  for (const [date, meta] of tripDates(state)) {
    const m = meta.cityId ? moveOn(date, meta.cityId) : undefined;
    if (m) out.set(date, m);
  }
  return out;
}

/** The travel-day card's line: the time the plan allows for the move, to
 *  five minutes, since it is an allowance, not a timetable. With no train
 *  time it gives no figure: the train card says there is no train in
 *  Bento's data, and the plan's warning says the guess, once. */
export function travelMoveLine(move: TravelMove, fromName: string): string {
  if (move.trainMin == null) return copy.trip.travelDay.moveUnknown(fromName);
  return copy.trip.travelDay.move(fromName, copy.time.duration(Math.round(move.minutes / 5) * 5));
}

/** After an edit lifted a travel day's start to the arrival (the address
 *  carries only `note=start-lifted`), the line the page shows, from the
 *  saved day. Null when there is no move or no timed stop. */
export function startLiftedLine(move: TravelMove | null | undefined, items: { startMin: number | null }[], fromName: string): string | null {
  const starts = items.map((i) => i.startMin).filter((m): m is number => m != null);
  if (!move || !starts.length) return null;
  return copy.plan.warnings.liftedStart(clock(toFive(Math.min(...starts))), fromName);
}

/** What the day box shows about how well Bento knows the day's city: the
 *  chip's words, whether the day can be edited and re-planned (not in a
 *  city Bento can't plan), whether it is the "can't plan here" box, and
 *  whether it carries the main-sights line. Anything unknown reads as not
 *  covered. */
export function dayCoverage(meta: { cityId: string | null; tier: string }, stops: number) {
  const tier = (meta.tier in copy.coverage ? meta.tier : "stub") as CoverageTier;
  return {
    words: copy.coverage[tier],
    editable: Boolean(meta.cityId) && tier !== "stub",
    uncovered: tier === "stub",
    mainSights: showsMainSights(tier, stops),
  };
}

/** Every date of the trip with its city: the route's, or a stored day's own. */
function tripDates(state: TripState) {
  const cityById = new Map(state.cities.map((c) => [c.cityId, c]));
  const dates = new Map<string, { cityId: string | null; cityName: string; tier: string }>();
  for (const c of allocateDates(state.trip.startDate, [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder), state.trip.endDate)) {
    for (const d of c.dates) dates.set(d, { cityId: c.cityId, cityName: cityById.get(c.cityId)?.name ?? c.cityId, tier: cityById.get(c.cityId)?.tier ?? "stub" });
  }
  for (const d of state.days) {
    // The day's own city first: a day trip's city is often not on the route.
    const c = d.cityId ? cityById.get(d.cityId) : null;
    dates.set(d.date, { cityId: d.cityId, cityName: d.city?.name ?? c?.name ?? d.cityId ?? "—", tier: d.city?.tier ?? c?.tier ?? "stub" });
  }
  return dates;
}

/** `moves` (`tripMoves`): a travel day is measured against the day less
 *  its move, as it was planned. Without them, every day is a whole day. */
export function buildTripView(state: TripState, requested: string | null, moves?: Map<string, TravelMove> | null) {
  const dates = tripDates(state);
  const dayList = [...dates.entries()].sort(([a], [b]) => a.localeCompare(b));
  const daysByDate = new Map(state.days.map((d) => [d.date, d]));
  const statsByDate = new Map(state.days.map((d) => [d.date, dayStats(d.items, state.prefs.pace, moves?.get(d.date)?.minutes ?? 0)]));
  const selected = requested && dates.has(requested) ? requested : dayList[0]?.[0] ?? null;
  const selectedDay = selected ? daysByDate.get(selected) : undefined;
  // Keep the public place names paired with the saved day data. A missing
  // mapName means the place is no longer in places_public, so the box hides its link.
  const dayItems = selectedDay?.items.map((item) => ({
    placeId: item.placeId,
    name: item.name,
    mapName: item.mapName ?? null,
    nameJa: item.nameJa ?? null,
    startMin: item.startMin,
    durationMin: item.durationMin,
    locked: item.locked,
    reason: item.reason,
    reasonTerms: item.reasonTerms,
    arriveMode: item.arriveMode,
    arriveMinutes: item.arriveMinutes,
    arriveDetail: item.arriveDetail,
  }));
  const selectedMeta = selected ? dates.get(selected)! : null;
  const stats = selectedDay ? statsByDate.get(selectedDay.date)! : null;
  return { dayList, statsByDate, selected, selectedDay, dayItems, selectedMeta, stats };
}
