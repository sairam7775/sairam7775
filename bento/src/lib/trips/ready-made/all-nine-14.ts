import type { ReadyMadeTrip } from "./types";

/** Four bases for nine cities: the other five are day trips or a stop on
 *  the way. It lands in Tokyo and ends in Osaka, for a flight home from
 *  Kansai Airport (the direction note's 14-day trip). Day 12 is planned as
 *  a day in Himeji on the way from Hiroshima (the ride on to Osaka that
 *  evening, and the luggage, aren't planned). Two must-sees a day at most. */
export const allNine14: ReadyMadeTrip = {
  id: "all-nine-14",
  days: 14,
  route: [
    { cityId: "tokyo-city", nights: 5 },
    { cityId: "kamakura", nights: 0 },
    { cityId: "yokohama", nights: 0 },
    { cityId: "kyoto-city", nights: 4 },
    { cityId: "nara-city", nights: 0 },
    { cityId: "hiroshima-city", nights: 2 },
    { cityId: "miyajima", nights: 0 },
    { cityId: "himeji", nights: 0 },
    { cityId: "osaka-city", nights: 2 },
  ],
  dayTrips: [
    { day: 3, cityId: "kamakura" },
    { day: 5, cityId: "yokohama" },
    { day: 8, cityId: "nara-city" },
    { day: 11, cityId: "miyajima" },
    { day: 12, cityId: "himeji" },
  ],
  mustSee: [
    ["tky-sensoji"],
    ["tky-meiji-jingu", "tky-shibuya-crossing"],
    ["kmk-kotoku-in", "kmk-tsurugaoka"],
    ["tky-tsukiji-outer", "tky-hamarikyu"],
    ["ykh-chinatown"],
    ["kyt-kiyomizu", "kyt-gion"],
    ["kyt-fushimi-inari", "kyt-nishiki-market"],
    ["nra-todaiji", "nra-kasuga-taisha"],
    ["kyt-arashiyama-bamboo", "kyt-kinkakuji"],
    ["hir-peace-park", "hir-peace-museum"],
    ["miy-itsukushima", "miy-great-torii"],
    ["hmj-castle", "hmj-kokoen"],
    ["osk-osaka-castle"],
    ["osk-kuromon"],
  ],
};
