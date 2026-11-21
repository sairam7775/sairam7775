/** Travel days: the day a traveller moves from one stay to the next. The
 *  day in the new city starts once they are there, not at the usual hour,
 *  and has that much less time. Pure: the route, the dates and the train
 *  graph in, the move out. */
import { allocateDates, routeBetweenCities, type CityFacts, type RouteCityInput } from "./route";
import type { Graph } from "@/lib/transit/graph";
import type { TravelMove } from "./types";

/** The morning of a move, besides the train: checking out, getting to the
 *  departure station and onto the platform with bags, and from the arrival
 *  station to the new hotel to leave them. A planning allowance, not a
 *  measured figure. It is less than `CHANGE_COST_MIN` (two hours, the whole
 *  cost of a city change in the route verdict) because packing comes before
 *  the usual start, like breakfast, and checking in comes after the day's
 *  sightseeing: hotels take bags in the morning and rooms from mid-afternoon. */
export const MOVE_ALLOWANCE_MIN = 60;

/** The train time assumed when Bento has no train between the two hubs:
 *  longer than the longest single move a ready-made trip makes (Tokyo to
 *  Kyoto, 134 minutes hub to hub in Bento's train data), so a guess errs
 *  towards a shorter day, never a crammed one. The day says it is a guess. */
export const UNKNOWN_TRAIN_MIN = 150;

/** The move to a city from the stay before, with its train when known. */
export function travelMove(fromCityId: string, trainMin: number | null): TravelMove {
  return { fromCityId, trainMin, minutes: MOVE_ALLOWANCE_MIN + (trainMin ?? UNKNOWN_TRAIN_MIN) };
}

/** Each travel day's date, with the city the traveller slept in the night
 *  before: the arrival date of every stay after the first. Not the trip's
 *  first day (arriving in Japan is a separate question), and never a day
 *  trip there and back from where they sleep, which is not a move. A stay
 *  in the same city as the one before is not a move either. */
export function travelDayOrigins(startDate: string | null, cities: RouteCityInput[], endDate: string | null = null): Map<string, string> {
  const out = new Map<string, string>();
  let before: string | null = null;
  for (const c of allocateDates(startDate, cities, endDate)) {
    if (c.nights === 0) continue;
    if (before && before !== c.cityId && c.arriveDate && (!endDate || c.arriveDate <= endDate)) out.set(c.arriveDate, before);
    before = c.cityId;
  }
  return out;
}

/** The move for a date planned in a city, from the route: what `plan_days`,
 *  a re-plan and the day box all use, so they never disagree. Undefined
 *  for any day that isn't a travel day.
 *
 *  The day's city must be the stay arriving that date, or a city that is
 *  not a stay of the route (Himeji on the way, a day trip on the arrival
 *  date): the move is from the last stay to it. A day saved for another
 *  stay of the route (planned before the route changed) is not moved. */
export function travelDayMoves(
  startDate: string | null,
  endDate: string | null,
  cities: RouteCityInput[],
  trainMinutes: (from: string, to: string) => number | null,
): (date: string, cityId: string) => TravelMove | undefined {
  const origins = travelDayOrigins(startDate, cities, endDate);
  const stays = new Set(cities.filter((c) => c.nights > 0).map((c) => c.cityId));
  const arriving = new Map<string, string>();
  for (const c of allocateDates(startDate, cities, endDate)) if (c.nights > 0 && c.arriveDate && origins.has(c.arriveDate)) arriving.set(c.arriveDate, c.cityId);
  return (date, cityId) => {
    const from = origins.get(date);
    if (!from || from === cityId) return undefined;
    if (stays.has(cityId) && arriving.get(date) !== cityId) return undefined;
    return travelMove(from, trainMinutes(from, cityId));
  };
}

/** A time said to a traveller about the move, to five minutes: it rests on
 *  an allowance, not a timetable. */
export function toFive(min: number): number {
  return Math.round(min / 5) * 5;
}

/** When a travel day starts. Nothing kept: the usual start plus the move.
 *  A kept start (a re-plan or an edit keeping its first stop) stays, unless
 *  it is before the traveller can arrive: a day saved before the move was
 *  allowed for. A start the traveller names is not this: it is taken as
 *  it is, with a warning (`planDay`). */
export function travelDayStart(kept: number | null | undefined, usualStart: number, move?: TravelMove): number {
  const arrive = usualStart + (move?.minutes ?? 0);
  if (kept == null) return arrive;
  return move ? Math.max(kept, arrive) : kept;
}

/** Train minutes between two cities' hubs, as the route's legs count them;
 *  null when Bento has no train between them. */
export function cityTrainMinutes(graph: Graph, facts?: Map<string, CityFacts>) {
  const memo = new Map<string, number | null>();
  return (from: string, to: string): number | null => {
    const k = `${from}>${to}`;
    if (!memo.has(k)) memo.set(k, routeBetweenCities(from, to, graph, facts)?.minutes ?? null);
    return memo.get(k)!;
  };
}
