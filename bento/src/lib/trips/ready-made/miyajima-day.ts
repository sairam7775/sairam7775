import type { ReadyMadeTrip } from "./types";

/** The day is on the island. Hiroshima is where most people come from,
 *  which the words say; a one-day trip has no night to spend there. */
export const miyajimaDay: ReadyMadeTrip = {
  id: "miyajima-day",
  days: 1,
  route: [{ cityId: "miyajima", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "miyajima" }],
  mustSee: [["miy-itsukushima", "miy-great-torii", "miy-daishoin"]],
};
