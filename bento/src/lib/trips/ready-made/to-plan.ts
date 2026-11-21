/** A ready-made trip plus a start date, as the planner's own inputs: the
 *  route in `propose_route`'s shape, each date with its city (day trips
 *  already moved to theirs, as `plan_days` does with a city_id), and the
 *  must-see places pinned on their dates. Pure: no database, no model.
 *  Starting a trip from one (package 1C) saves the route and plans these
 *  days through the same paths a chat-built trip uses. */
import { allocateDates, type RouteCityInput } from "@/lib/engine/route";
import type { TripDay } from "@/lib/engine/trip";
import { travelDayOrigins } from "@/lib/engine/travel-day";
import { copy } from "@/copy";
import type { ReadyMadeTrip } from "./types";

export interface ReadyMadePlanInput {
  startDate: string;
  /** The trip's last day: start + days − 1. */
  endDate: string;
  /** Cities with nights and a reason each, as `propose_route` takes them. */
  route: (RouteCityInput & { reason: string })[];
  /** Every date of the trip, in order, with its city and its pins:
   *  `planTrip`'s days. */
  days: TripDay[];
  /** The dates spent in a zero-night city, as `plan_days` takes them. */
  dayTrips: { date: string; cityId: string }[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function readyMadeToPlan(trip: ReadyMadeTrip, startDate: string): ReadyMadePlanInput {
  if (!ISO_DATE.test(startDate) || addDays(startDate, 0) !== startDate) throw new Error(`not a date: ${startDate}`);
  const endDate = addDays(startDate, trip.days - 1);
  const reasons: Record<string, string> = copy.readyMade.trips[trip.id].reasons;
  const route = trip.route.map((c) => ({ cityId: c.cityId, nights: c.nights, reason: reasons[c.cityId] }));

  const cityOn = new Map<string, string>();
  for (const c of allocateDates(startDate, route, endDate)) for (const d of c.dates) cityOn.set(d, c.cityId);
  const dayTrips = trip.dayTrips.map((t) => ({ date: addDays(startDate, t.day - 1), cityId: t.cityId }));
  for (const t of dayTrips) cityOn.set(t.date, t.cityId);

  // A travel day keeps the city it was given (Himeji, on the way to
  // Hiroshima) and starts after the move there from the last stay.
  const origins = travelDayOrigins(startDate, route, endDate);
  const days: TripDay[] = [];
  for (let i = 0; i < trip.days; i++) {
    const date = addDays(startDate, i);
    const cityId = cityOn.get(date);
    if (!cityId) throw new Error(`${trip.id}: day ${i + 1} has no city`);
    const movingFrom = origins.get(date);
    days.push({ date, cityId, locked: (trip.mustSee[i] ?? []).map((placeId) => ({ placeId })), ...(movingFrom ? { movingFrom } : {}) });
  }
  return { startDate, endDate, route, days, dayTrips };
}
