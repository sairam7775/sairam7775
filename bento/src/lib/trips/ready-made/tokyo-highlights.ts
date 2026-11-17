import type { ReadyMadeTrip } from "./types";

export const tokyoHighlights: ReadyMadeTrip = {
  id: "tokyo-highlights",
  days: 1,
  route: [{ cityId: "tokyo-city", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "tokyo-city" }],
  // Meiji Jingu closes earliest, so it goes first; Senso-ji's grounds stay
  // open into the evening.
  mustSee: [["tky-meiji-jingu", "tky-shibuya-crossing", "tky-sensoji"]],
};
