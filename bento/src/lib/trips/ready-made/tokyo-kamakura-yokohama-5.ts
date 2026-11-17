import type { ReadyMadeTrip } from "./types";

export const tokyoKamakuraYokohama5: ReadyMadeTrip = {
  id: "tokyo-kamakura-yokohama-5",
  days: 5,
  route: [
    { cityId: "tokyo-city", nights: 4 },
    { cityId: "kamakura", nights: 0 },
    { cityId: "yokohama", nights: 0 },
  ],
  dayTrips: [
    { day: 3, cityId: "kamakura" },
    { day: 4, cityId: "yokohama" },
  ],
  mustSee: [
    ["tky-sensoji", "tky-ueno-park", "tky-akihabara"],
    ["tky-tsukiji-outer", "tky-hamarikyu", "tky-ginza"],
    ["kmk-kotoku-in", "kmk-hasedera", "kmk-tsurugaoka"],
    ["ykh-chinatown", "ykh-yamashita", "ykh-red-brick"],
    ["tky-meiji-jingu", "tky-takeshita", "tky-shibuya-crossing"],
  ],
};
