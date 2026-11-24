import type { ReadyMadeTrip } from "./types";

/** A loop from Kansai Airport: Kyoto first, Himeji on the way west, then
 *  back to Osaka to fly home, with Nara as a day trip from Osaka. Day 3 is
 *  planned as a day in Himeji: the ride on to Hiroshima that evening, and
 *  the luggage, aren't planned. */
export const kansaiHiroshima7: ReadyMadeTrip = {
  id: "kansai-hiroshima-7",
  days: 7,
  route: [
    { cityId: "kyoto-city", nights: 2 },
    { cityId: "himeji", nights: 0 },
    { cityId: "hiroshima-city", nights: 2 },
    { cityId: "osaka-city", nights: 2 },
    { cityId: "nara-city", nights: 0 },
  ],
  dayTrips: [
    { day: 3, cityId: "himeji" },
    { day: 6, cityId: "nara-city" },
  ],
  mustSee: [
    ["kyt-kiyomizu"],
    ["kyt-arashiyama-bamboo", "kyt-kinkakuji"],
    ["hmj-castle", "hmj-kokoen"],
    ["hir-peace-park", "hir-peace-museum"],
    ["osk-dotonbori"],
    ["nra-todaiji", "nra-kasuga-taisha"],
    ["osk-osaka-castle"],
  ],
};
