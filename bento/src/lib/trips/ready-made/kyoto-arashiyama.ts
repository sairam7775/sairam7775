import type { ReadyMadeTrip } from "./types";

export const kyotoArashiyama: ReadyMadeTrip = {
  id: "kyoto-arashiyama",
  days: 1,
  route: [{ cityId: "kyoto-city", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "kyoto-city" }],
  mustSee: [["kyt-arashiyama-bamboo", "kyt-tenryuji"]],
};
