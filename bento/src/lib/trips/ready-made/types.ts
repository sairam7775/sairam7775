/** A ready-made trip is SAVED INPUT TO THE PLANNER, never a hand-written
 *  itinerary: the cities with their nights, which day is a day trip, and up
 *  to three places per day the engine must keep. The engine builds the
 *  actual days from that for the traveller's dates, pace and party, so
 *  closing days and seasons follow the real calendar, and a place whose
 *  hours change is right again in every trip without an edit.
 *
 *  So a trip file never states a time, a fare or a duration. Those come
 *  only from the engine. Words a traveller reads (title, summary, a reason
 *  per city) live in `copy.readyMade.trips[id]`. */
import type { Copy } from "@/copy";

export type ReadyMadeTripId = keyof Copy["readyMade"]["trips"];

/** Where a ready-made trip may go. Every city here must be outline or deep
 *  on the live site before a trip that uses it is published: the planner
 *  refuses a city it doesn't know (a stub), so a trip through one would
 *  fail. On 17 Nov 2026 Kyoto, Osaka, Nara and Hiroshima were; Tokyo,
 *  Miyajima, Himeji, Kamakura and Yokohama still need promoting (package 1A
 *  of docs/bento/60-direction/ready-made-trips.md). */
export const READY_MADE_CITIES = [
  "kyoto-city",
  "osaka-city",
  "nara-city",
  "hiroshima-city",
  "tokyo-city",
  "miyajima",
  "himeji",
  "kamakura",
  "yokohama",
] as const;

export interface ReadyMadeCity {
  cityId: string;
  /** 0 is a day trip from where you sleep, or a stop on the way. */
  nights: number;
}

export interface ReadyMadeTrip {
  id: ReadyMadeTripId;
  /** Calendar days, first to last. The nights add up to one fewer: the last
   *  day is spent in the last city, the way a trip's end date works. */
  days: number;
  /** Travel order, in the shape `propose_route` and `allocateDates` take. */
  route: ReadyMadeCity[];
  /** Which day (1 = the first) is spent in a zero-night city. Every
   *  zero-night city on the route has its day here. */
  dayTrips: { day: number; cityId: string }[];
  /** One list per day, in order: up to three place ids, in that day's city,
   *  that the engine keeps (as pins). It fills the rest of the day around
   *  them, but never reorders pins: list them in visiting order, the one
   *  that closes earliest first. The first and last day of a longer trip
   *  carry one at most (the traveller is arriving or leaving), and every
   *  full day leaves room for at least one stop the planner chooses, at
   *  every pace: in practice two must-sees a day, one when they are long. */
  mustSee: string[][];
}
