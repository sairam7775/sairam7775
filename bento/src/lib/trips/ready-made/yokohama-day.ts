import type { ReadyMadeTrip } from "./types";

export const yokohamaDay: ReadyMadeTrip = {
  id: "yokohama-day",
  days: 1,
  route: [{ cityId: "yokohama", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "yokohama" }],
  mustSee: [["ykh-chinatown"]],
};
