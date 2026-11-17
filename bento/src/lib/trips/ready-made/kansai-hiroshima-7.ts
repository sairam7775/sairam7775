import type { ReadyMadeTrip } from "./types";

/** Nara as a day trip from Osaka; Himeji a stop on the train from Kyoto
 *  to Hiroshima. */
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
    ["osk-osaka-castle", "osk-kuromon", "osk-dotonbori"],
    ["nra-todaiji", "nra-nara-park", "nra-kasuga-taisha"],
    ["kyt-fushimi-inari", "kyt-kiyomizu", "kyt-gion"],
    ["kyt-arashiyama-bamboo", "kyt-tenryuji", "kyt-kinkakuji"],
    ["hmj-castle", "hmj-kokoen"],
    ["hir-peace-park", "hir-atomic-dome", "hir-peace-museum"],
    ["hir-shukkeien", "hir-castle", "hir-okonomimura"],
  ],
};
