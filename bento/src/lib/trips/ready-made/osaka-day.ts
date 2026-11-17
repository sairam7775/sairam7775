import type { ReadyMadeTrip } from "./types";

export const osakaDay: ReadyMadeTrip = {
  id: "osaka-day",
  days: 1,
  route: [{ cityId: "osaka-city", nights: 0 }],
  dayTrips: [{ day: 1, cityId: "osaka-city" }],
  mustSee: [["osk-osaka-castle", "osk-kuromon", "osk-dotonbori"]],
};
