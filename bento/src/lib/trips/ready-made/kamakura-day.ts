import type { ReadyMadeTrip } from "./types";

export const kamakuraDay: ReadyMadeTrip = {
  id: "kamakura-day",
  days: 1,
  route: [{ cityId: "kamakura", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "kamakura" }],
  mustSee: [["kmk-kotoku-in", "kmk-tsurugaoka"]],
};
