import type { ReadyMadeTrip } from "./types";

export const tokyoHighlights: ReadyMadeTrip = {
  id: "tokyo-highlights",
  days: 1,
  route: [{ cityId: "tokyo-city", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "tokyo-city" }],
  mustSee: [["tky-meiji-jingu", "tky-sensoji"]],
};
