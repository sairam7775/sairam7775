/** Every ready-made trip, shortest first. A new trip is a new file in this
 *  folder, registered here, with its words in `copy.readyMade.trips`: the
 *  tests read this list, so a trip left out of it is never checked. */
import type { ReadyMadeTrip } from "./types";
import { tokyoHighlights } from "./tokyo-highlights";
import { kyotoEast } from "./kyoto-east";
import { kyotoArashiyama } from "./kyoto-arashiyama";
import { osakaDay } from "./osaka-day";
import { naraDay } from "./nara-day";
import { kamakuraDay } from "./kamakura-day";
import { yokohamaDay } from "./yokohama-day";
import { miyajimaDay } from "./miyajima-day";
import { tokyo2 } from "./tokyo-2";
import { kyoto2 } from "./kyoto-2";
import { tokyoKamakura3 } from "./tokyo-kamakura-3";
import { kyotoNara3 } from "./kyoto-nara-3";
import { tokyoKamakuraYokohama5 } from "./tokyo-kamakura-yokohama-5";
import { osakaKyotoNara5 } from "./osaka-kyoto-nara-5";
import { classic7 } from "./classic-7";
import { kansaiHiroshima7 } from "./kansai-hiroshima-7";
import { tokyoToMiyajima10 } from "./tokyo-to-miyajima-10";
import { allNine14 } from "./all-nine-14";

export type { ReadyMadeTrip, ReadyMadeTripId } from "./types";
export { READY_MADE_CITIES } from "./types";
export { readyMadeToPlan, type ReadyMadePlanInput } from "./to-plan";

export const readyMadeTrips: ReadyMadeTrip[] = [
  tokyoHighlights,
  kyotoEast,
  kyotoArashiyama,
  osakaDay,
  naraDay,
  kamakuraDay,
  yokohamaDay,
  miyajimaDay,
  tokyo2,
  kyoto2,
  tokyoKamakura3,
  kyotoNara3,
  tokyoKamakuraYokohama5,
  osakaKyotoNara5,
  classic7,
  kansaiHiroshima7,
  tokyoToMiyajima10,
  allNine14,
];

/** The trips of one length, in list order. */
export const readyMadeTripsFor = (days: number): ReadyMadeTrip[] => readyMadeTrips.filter((t) => t.days === days);
