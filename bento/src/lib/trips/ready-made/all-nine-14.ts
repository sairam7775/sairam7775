import type { ReadyMadeTrip } from "./types";

/** Four bases for nine cities: the other five are day trips or, for
 *  Himeji, a stop on the train. Two must-sees a day keeps it easy. */
export const allNine14: ReadyMadeTrip = {
  id: "all-nine-14",
  days: 14,
  route: [
    { cityId: "tokyo-city", nights: 5 },
    { cityId: "kamakura", nights: 0 },
    { cityId: "yokohama", nights: 0 },
    { cityId: "kyoto-city", nights: 4 },
    { cityId: "nara-city", nights: 0 },
    { cityId: "osaka-city", nights: 1 },
    { cityId: "himeji", nights: 0 },
    { cityId: "hiroshima-city", nights: 3 },
    { cityId: "miyajima", nights: 0 },
  ],
  dayTrips: [
    { day: 3, cityId: "kamakura" },
    { day: 5, cityId: "yokohama" },
    { day: 8, cityId: "nara-city" },
    { day: 11, cityId: "himeji" },
    { day: 13, cityId: "miyajima" },
  ],
  mustSee: [
    ["tky-sensoji", "tky-ueno-park"],
    ["tky-meiji-jingu", "tky-shibuya-crossing"],
    ["kmk-kotoku-in", "kmk-tsurugaoka"],
    ["tky-tsukiji-outer", "tky-hamarikyu"],
    ["ykh-chinatown", "ykh-yamashita"],
    ["kyt-kiyomizu", "kyt-gion"],
    ["kyt-fushimi-inari", "kyt-nijo-castle"],
    ["nra-todaiji", "nra-nara-park"],
    ["kyt-arashiyama-bamboo", "kyt-kinkakuji"],
    ["osk-osaka-castle", "osk-dotonbori"],
    ["hmj-castle", "hmj-kokoen"],
    ["hir-peace-park", "hir-peace-museum"],
    ["miy-itsukushima", "miy-great-torii"],
    ["hir-shukkeien", "hir-okonomimura"],
  ],
};
