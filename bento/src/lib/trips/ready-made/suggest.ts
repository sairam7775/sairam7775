/** Which ready-made trips Bento Man's `suggest_route` offers (package 1D of
 *  docs/bento/60-direction/ready-made-trips.md), so the chat and the picker
 *  on /trips/plan offer the same trips. Pure: no database, no model.
 *
 *  The tool works in nights; a trip in days. A trip of N nights is N + 1
 *  calendar days (a ready-made trip's nights add up to one fewer than its
 *  days, the way a trip's end date works). Only when the caller allows it
 *  (the model passed the nights; the trip has no dates to fit) and no trip
 *  that may be offered is N + 1 days long, the trips of N days are offered
 *  instead, one night shorter: a traveller who says "a week" may mean seven
 *  days or seven nights. A trip with dates gets exact lengths only, since
 *  propose_route refuses a route whose nights don't fit them. Nothing else
 *  is offered; the corridor table answers instead. Interests and excludes
 *  play no part: the picker doesn't weigh them either. */
import type { CoverageTier } from "@/lib/types";
import { availableReadyMade } from "./start";
import type { ReadyMadeTrip } from "./types";

export interface ReadyMadeMatch {
  /** In the picker's order. Empty when nothing matches. */
  trips: ReadyMadeTrip[];
  /** False when the trips are one night shorter than the nights asked for. */
  exact: boolean;
}

/** The trips for `nights` nights among those the picker may offer: every
 *  city, day trips included, planned in `tiers` (the same rule as
 *  `availableReadyMade`; a city it doesn't list counts as not planned). */
export function readyMadeForNights(nights: number, tiers: Map<string, CoverageTier>, opts: { allowShorter?: boolean } = {}): ReadyMadeMatch {
  const offered = availableReadyMade(tiers);
  const exact = offered.filter((t) => t.days === nights + 1);
  if (exact.length || !opts.allowShorter) return { trips: exact, exact: true };
  const shorter = offered.filter((t) => t.days === nights);
  return shorter.length ? { trips: shorter, exact: false } : { trips: [], exact: true };
}

const nightsWord = (n: number) => `${n} night${n === 1 ? "" : "s"}`;

/** What a one-night-shorter match is, as data for the tool result. */
export const shorterNote = (asked: number) => `${nightsWord(asked - 1)}, one fewer than the ${nightsWord(asked)} asked for`;
