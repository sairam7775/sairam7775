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
  cost: number;
  booking?: BookingRequirement;
  lead?: number;
  /** "HH:MM"; omit for always open */
  opens?: string;
  closes?: string;
  /** 0 = Sunday */
  closedWeekdays?: number[];
  conflicts?: string[];
  pairs?: string[];
  seasons?: string[];
  /** Where a verifier should look. Official site domain when known. */
  sources: string[];
}

/** Fill the defaults so a record is a handful of lines, not forty. */
export const draft = (p: PlaceSeed): PlaceSeed => p;
