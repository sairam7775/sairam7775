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
    ["kyt-fushimi-inari", "kyt-kiyomizu", "kyt-gion"],
    ["nra-todaiji", "nra-nara-park", "nra-kasuga-taisha"],
    ["kyt-arashiyama-bamboo", "kyt-tenryuji", "kyt-kinkakuji"],
  ],
};
