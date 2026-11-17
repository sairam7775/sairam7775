import type { ReadyMadeTrip } from "./types";

export const kyotoEast: ReadyMadeTrip = {
  id: "kyoto-east",
  days: 1,
  route: [{ cityId: "kyoto-city", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "kyoto-city" }],
  mustSee: [["kyt-kiyomizu", "kyt-gion"]],
};
