import type { ReadyMadeTrip } from "./types";

/** Fushimi Inari and Arashiyama on different days: they conflict. */
export const kyoto2: ReadyMadeTrip = {
  id: "kyoto-2",
  days: 2,
  route: [{ cityId: "kyoto-city", nights: 1 }],
  dayTrips: [],
  mustSee: [
    ["kyt-kiyomizu"],
    ["kyt-arashiyama-bamboo"],
  ],
};
