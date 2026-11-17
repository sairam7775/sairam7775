import type { ReadyMadeTrip } from "./types";

export const naraDay: ReadyMadeTrip = {
  id: "nara-day",
  days: 1,
  route: [{ cityId: "nara-city", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "nara-city" }],
  mustSee: [["nra-todaiji", "nra-kasuga-taisha"]],
};
