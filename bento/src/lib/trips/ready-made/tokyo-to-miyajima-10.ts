import type { ReadyMadeTrip } from "./types";

/** Lands in Tokyo and ends with a night in Osaka, for a flight home from
 *  Kansai Airport, rather than in Hiroshima. */
export const tokyoToMiyajima10: ReadyMadeTrip = {
  id: "tokyo-to-miyajima-10",
  days: 10,
  route: [
    { cityId: "tokyo-city", nights: 3 },
    { cityId: "kyoto-city", nights: 3 },
    { cityId: "nara-city", nights: 0 },
    { cityId: "hiroshima-city", nights: 2 },
    { cityId: "miyajima", nights: 0 },
    { cityId: "osaka-city", nights: 1 },
  ],
  dayTrips: [
    { day: 6, cityId: "nara-city" },
    { day: 8, cityId: "miyajima" },
  ],
  mustSee: [
    ["tky-sensoji"],
    ["tky-meiji-jingu", "tky-shibuya-crossing"],
    ["tky-tsukiji-outer", "tky-hamarikyu"],
    ["kyt-kiyomizu", "kyt-gion"],
    ["kyt-arashiyama-bamboo", "kyt-kinkakuji"],
    ["nra-todaiji", "nra-kasuga-taisha"],
    ["hir-peace-park", "hir-peace-museum"],
    ["miy-itsukushima", "miy-great-torii"],
    ["osk-dotonbori"],
    ["osk-osaka-castle"],
  ],
};
