import type { ReadyMadeTrip } from "./types";

/** Tokyo, then Kyoto as the base for the second half, with Osaka as a day
 *  trip from it: three cities without a third hotel. */
export const classic7: ReadyMadeTrip = {
  id: "classic-7",
  days: 7,
  route: [
    { cityId: "tokyo-city", nights: 3 },
    { cityId: "kyoto-city", nights: 3 },
    { cityId: "osaka-city", nights: 0 },
  ],
  dayTrips: [{ day: 6, cityId: "osaka-city" }],
  mustSee: [
    ["tky-sensoji", "tky-ueno-park", "tky-akihabara"],
    ["tky-meiji-jingu", "tky-takeshita", "tky-shibuya-crossing"],
    ["tky-tsukiji-outer", "tky-hamarikyu", "tky-ginza"],
    ["kyt-kiyomizu", "kyt-ninenzaka", "kyt-gion"],
    ["kyt-fushimi-inari", "kyt-nijo-castle", "kyt-nishiki-market"],
    ["osk-osaka-castle", "osk-kuromon", "osk-dotonbori"],
    ["kyt-arashiyama-bamboo", "kyt-tenryuji", "kyt-kinkakuji"],
  ],
};
