/** A drafted place, in the shape the curation pipeline expects (§10).
 *
 *  Every record written here lands as a DRAFT: its judgement fields stay
 *  hidden from travellers until a human verifies it in /admin. Facts are
 *  checkable against a source; judgement is what a friend would tell you.
 *  Both are seed values until signed off. */
import type { BookingRequirement, InterestTag } from "@/lib/types";

export interface PlaceSeed {
  id: string;
  city: string;
  name: string;
  nameJa: string;
  /** shrine · temple · castle · garden · museum · market · street · district ·
   *  viewpoint · park · nature · hike · memorial · food · shopping · onsen ·
   *  aquarium · performance · sport · island */
  category: string;
  lat: number;
  lon: number;
  /** Station id in the transit seed, or null when only a bus or walk serves it. */
  station: string | null;
  walk: number | null;
  tags: InterestTag[];
  /** 0 sit and look · 1 all-day effort */
  energy: number;
  /** 0 empty · 1 shoulder to shoulder at its worst */
  crowd: number;
  /** 0 on every list · 1 most visitors miss it */
  discovery: number;
  /** How much a first-timer would regret missing it, 0–1 */
  signature: number;
  physical?: number;
  /** minutes: seen it · what most people spend · doing all of it */
  taste: number;
  typical: number;
  full: number;
  window?: string[];
  crowdNote: string;
  worthIf?: string[];
  skipIf?: string[];
  tip: string;
  /** Adult entry to the main paid part, JPY; 0 when free. Travellers only
   *  ever see its band (engine/cost-band.ts), so change it when the price
   *  moves to another band. Other prices (a garden, a hall) go in the tip. */
  cost: number;
  booking?: BookingRequirement;
  lead?: number;
  /** "HH:MM"; omit for always open. Seasonal hours: the SHORTEST of the
   *  year, with hoursVary, so the planner never arrives after closing. */
  opens?: string;
  closes?: string;
  /** The hours change with the season; travellers are told to check. */
  hoursVary?: boolean;
  /** Only worth visiting in the evening: set only when the place's own
   *  notes say it is dead or closed by day (Pontocho, "Dead by day"). The
   *  planner never plans it before its evening window. A place that opens
   *  at 17:00 or later is treated so by its hours, flag or not; an evening
   *  best window alone stays a soft preference. */
  eveningOnly?: boolean;
  /** 0 = Sunday */
  closedWeekdays?: number[];
  /** Weekdays when the place is open but many of its shops close (a market
   *  whose stalls keep their own days off). Not a closing day: the planner
   *  won't choose it then, a pin stays with a warning, and a ready-made
   *  start isn't refused. 0 = Sunday. Set by id in a migration too (0035). */
  manyClosedWeekdays?: number[];
  /** Closed on these dates every year, such as the year-end break:
   *  "MM-DD..MM-DD" (an end before the start wraps the year: "12-28..01-01")
   *  or one "MM-DD". Only from the place's own published closing days. */
  closedYearly?: string[];
  conflicts?: string[];
  pairs?: string[];
  seasons?: string[];
  /** Where a verifier should look. Official site domain when known. */
  sources: string[];
}

/** Fill the defaults so a record is a handful of lines, not forty. */
export const draft = (p: PlaceSeed): PlaceSeed => p;
