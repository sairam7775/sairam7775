import type { ReadyMadeTrip } from "./types";

export const tokyo2: ReadyMadeTrip = {
  id: "tokyo-2",
  days: 2,
  route: [{ cityId: "tokyo-city", nights: 1 }],
  dayTrips: [],
  mustSee: [
    ["tky-sensoji", "tky-ueno-park", "tky-akihabara"],
    ["tky-meiji-jingu", "tky-takeshita", "tky-shibuya-crossing"],
  ],
};
