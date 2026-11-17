import type { ReadyMadeTrip } from "./types";

/** Nara as a day trip from Osaka. Day 5 is planned as a day in Himeji: the
 *  ride on to Hiroshima that evening, and the luggage, aren't planned. */
export const kansaiHiroshima7: ReadyMadeTrip = {
  id: "kansai-hiroshima-7",
  days: 7,
  route: [
    { cityId: "osaka-city", nights: 2 },
    { cityId: "nara-city", nights: 0 },
    { cityId: "kyoto-city", nights: 2 },
    { cityId: "himeji", nights: 0 },
    { cityId: "hiroshima-city", nights: 2 },
  ],
  dayTrips: [
    { day: 2, cityId: "nara-city" },
    { day: 5, cityId: "himeji" },
  ],
  mustSee: [
    ["osk-dotonbori"],
    ["nra-todaiji", "nra-kasuga-taisha"],
    ["kyt-kiyomizu", "kyt-gion"],
    ["kyt-arashiyama-bamboo", "kyt-kinkakuji"],
    ["hmj-castle", "hmj-kokoen"],
    ["hir-peace-park", "hir-peace-museum"],
    ["hir-shukkeien"],
  ],
};
