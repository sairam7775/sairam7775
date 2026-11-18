import type { ReadyMadeTrip } from "./types";

export const osakaKyotoNara5: ReadyMadeTrip = {
  id: "osaka-kyoto-nara-5",
  days: 5,
  route: [
    { cityId: "osaka-city", nights: 2 },
    { cityId: "kyoto-city", nights: 2 },
    { cityId: "nara-city", nights: 0 },
  ],
  dayTrips: [{ day: 4, cityId: "nara-city" }],
  mustSee: [
    ["osk-dotonbori"],
    ["osk-osaka-castle"],
    ["kyt-kiyomizu", "kyt-gion"],
    ["nra-todaiji", "nra-kasuga-taisha"],
    ["kyt-arashiyama-bamboo"],
  ],
};
