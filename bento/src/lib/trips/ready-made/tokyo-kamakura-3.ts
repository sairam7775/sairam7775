import type { ReadyMadeTrip } from "./types";

export const tokyoKamakura3: ReadyMadeTrip = {
  id: "tokyo-kamakura-3",
  days: 3,
  route: [
    { cityId: "tokyo-city", nights: 2 },
    { cityId: "kamakura", nights: 0 },
  ],
  dayTrips: [{ day: 2, cityId: "kamakura" }],
  mustSee: [
    ["tky-sensoji"],
    ["kmk-kotoku-in", "kmk-tsurugaoka"],
    ["tky-meiji-jingu"],
  ],
};
