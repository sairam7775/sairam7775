import type { ReadyMadeTrip } from "./types";

export const kyotoNara3: ReadyMadeTrip = {
  id: "kyoto-nara-3",
  days: 3,
  route: [
    { cityId: "kyoto-city", nights: 2 },
    { cityId: "nara-city", nights: 0 },
  ],
  dayTrips: [{ day: 2, cityId: "nara-city" }],
  mustSee: [
    ["kyt-kiyomizu"],
    ["nra-todaiji", "nra-kasuga-taisha"],
    ["kyt-fushimi-inari"],
  ],
};
