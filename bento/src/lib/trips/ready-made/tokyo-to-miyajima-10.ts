import type { ReadyMadeTrip } from "./types";

export const tokyoToMiyajima10: ReadyMadeTrip = {
  id: "tokyo-to-miyajima-10",
  days: 10,
  route: [
    { cityId: "tokyo-city", nights: 3 },
    { cityId: "kyoto-city", nights: 3 },
    { cityId: "nara-city", nights: 0 },
    { cityId: "osaka-city", nights: 1 },
    { cityId: "hiroshima-city", nights: 2 },
    { cityId: "miyajima", nights: 0 },
  ],
  dayTrips: [
    { day: 6, cityId: "nara-city" },
    { day: 9, cityId: "miyajima" },
  ],
  mustSee: [
    ["tky-sensoji", "tky-ueno-park", "tky-akihabara"],
    ["tky-meiji-jingu", "tky-takeshita", "tky-shibuya-crossing"],
    ["tky-tsukiji-outer", "tky-hamarikyu", "tky-ginza"],
    ["kyt-kiyomizu", "kyt-ninenzaka", "kyt-gion"],
    ["kyt-arashiyama-bamboo", "kyt-tenryuji", "kyt-kinkakuji"],
    ["nra-todaiji", "nra-nara-park", "nra-kasuga-taisha"],
    ["osk-osaka-castle", "osk-kuromon", "osk-dotonbori"],
    ["hir-peace-park", "hir-atomic-dome", "hir-peace-museum"],
    ["miy-itsukushima", "miy-great-torii", "miy-daishoin"],
    ["hir-shukkeien", "hir-castle"],
  ],
};
