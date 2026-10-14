/** What Bento Man's tools read and write, behind one interface.
 *
 *  Two implementations: Supabase for the product (store.supabase.ts), and
 *  an in-memory one here for the eval set and the tests, so the whole
 *  conversation layer runs without a database — the same way the engine
 *  runs without one. */
import type { PlaceInput } from "@/lib/engine/types";
import type { CityFacts } from "@/lib/engine/route";
import type { Graph } from "@/lib/transit/graph";
import type { BudgetBand, CoverageTier, InterestTag, TravelPace, TripStatus } from "@/lib/types";
import type { Proposal } from "./diff";
import type { TicketLike } from "@/lib/vault/match";

export interface Prefs {
  pace: TravelPace;
  interestTags: InterestTag[];
  energy: number;
  crowdTolerance: number;
  discovery: number;
  excludes: string[];
  mobility: string[];
  dietary: string[];
  displayCurrency: string;
  /** False until the traveller has answered anything — onboarding runs. */
  set: boolean;
  /** The traveller said Bento Man may change trip dates without asking
   *  (#6). Only the traveller's own action sets it, never a tool. */
  autoApplyDates: boolean;
}

/** What the set_preferences tool may write: everything but the flags. */
export type PrefsPatch = Partial<Omit<Prefs, "set" | "autoApplyDates">>;

export const DEFAULT_PREFS: Prefs = {
  pace: "standard",
  interestTags: [],
  energy: 0.5,
  crowdTolerance: 0.5,
  discovery: 0.5,
  excludes: [],
  mobility: [],
  dietary: [],
  displayCurrency: "JPY",
  set: false,
  autoApplyDates: false,
};

export interface TripMeta {
  id: string;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  partySize: number;
  status: TripStatus;
}

export interface TripCityRow {
  cityId: string;
  name: string;
  tier: CoverageTier;
  nights: number;
  sortOrder: number;
  budgetBand: BudgetBand | null;
  reason: string | null;
  arriveDate: string | null;
  departDate: string | null;
}

export interface ItemRow {
  id?: string;
  placeId: string;
  name: string;
  sortOrder: number;
  startMin: number | null;
  durationMin: number | null;
  locked: boolean;
  reason: string | null;
  reasonTerms: string[];
  arriveMode: string | null;
  arriveMinutes: number | null;
  arriveDetail: string | null;
}

export interface DayRow {
  id?: string;
  date: string;
  cityId: string | null;
  items: ItemRow[];
}

export interface TripState {
  trip: TripMeta;
  prefs: Prefs;
  cities: TripCityRow[];
  days: DayRow[];
  /** A proposal the traveller has not answered yet. */
  pendingProposal: { id: string; summary: string } | null;
}

export interface TripPatch {
  startDate?: string | null;
  endDate?: string | null;
  partySize?: number;
  title?: string | null;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TripStore {
  state(): Promise<TripState>;
  savePreferences(p: PrefsPatch): Promise<Prefs>;
  /** The traveller's answer to "change dates without asking?". */
  setAutoApplyDates(on: boolean): Promise<void>;
  setTripDates(p: TripPatch): Promise<TripMeta>;
  /** The trip as setTripDates would leave it, refused with the same message
   *  if it would refuse, and nothing written. `route` checks the range
   *  against a route proposed alongside instead of the accepted one. */
  previewTripDates(p: TripPatch, route?: { nights: number }[]): Promise<TripMeta>;
  cities(): Promise<CityFacts[]>;
  places(cityId: string): Promise<PlaceInput[]>;
  searchPlaces(query: string, cityId?: string | null): Promise<PlaceInput[]>;
  graph(): Promise<Graph>;
  /** The trip's bookings, as much as the planner needs to know a ticket is
   *  held (lib/vault/match.ts). Never the reference. */
  bookings(): Promise<TicketLike[]>;
  history(limit: number): Promise<ChatTurn[]>;
  append(role: "user" | "assistant", content: string, proposal?: Proposal | null): Promise<{ id: string }>;
  /** Writes the accepted proposal into the itinerary. */
  /** Apply an accepted proposal. With `messageId` (the stored proposal), the
   *  claim on it, the route, every day and the closing of older proposals are
   *  one transaction. */
  applyProposal(p: Proposal, messageId?: string): Promise<void>;
  /** Replaces one day's stops with the traveller's own edit (reorder, pin,
   *  remove), already re-timed by the engine. The other path by which a
   *  plan changes — and it is the traveller's hand, never the model's. */
  saveDay(day: DayRow): Promise<void>;
}

/** Nights between two ISO dates, or null. */
export function nightsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

/** "YYYY-MM-DD" moved by n days. */
export function shiftDate(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** What a change of trip dates means for the accepted plan, decided before
 *  anything is written. Both stores and both callers (the Edit trip form and
 *  Bento Man's set_trip_dates) go through this, so they agree.
 *
 *  - `changed`: the dates actually differ. Saving a rename with the same
 *    dates is not a date change and must not close pending day plans.
 *  - `error`: the new range can't hold the accepted route. Laying a 9-night
 *    route into 3 nights would look like a working plan and isn't one.
 *  - `shift`: how far the start moved. The route is laid from the start, so
 *    planned days move by the same amount to stay on their city's dates.
 *  - A planned day that would land outside the new range is refused too,
 *    rather than deleted (someone's plan) or left showing after the trip ends. */
export function planDateChange(
  current: { startDate: string | null; endDate: string | null },
  next: { startDate?: string | null; endDate?: string | null },
  route: { nights: number }[],
  /** Dates of days that have stops planned. */
  plannedDays: string[] = [],
): { changed: boolean; error: string | null; shift: number; startDate: string | null; endDate: string | null } {
  const startDate = next.startDate !== undefined ? next.startDate : current.startDate;
  const endDate = next.endDate !== undefined ? next.endDate : current.endDate;
  const changed = startDate !== current.startDate || endDate !== current.endDate;
  if (!changed) return { changed, error: null, shift: 0, startDate, endDate };

  if (startDate && endDate && endDate < startDate) {
    return { changed, error: "The end date is before the start date.", shift: 0, startDate, endDate };
  }
  const tripNights = nightsBetween(startDate, endDate);
  const routeNights = route.reduce((s, c) => s + c.nights, 0);
  if (route.length && tripNights != null && routeNights > tripNights) {
    return {
      changed,
      error: `Your route is ${routeNights} nights, and those dates are only ${tripNights}. Shorten the route first, or pick dates with at least ${routeNights} nights.`,
      shift: 0,
      startDate,
      endDate,
    };
  }
  const shift = current.startDate && startDate ? nightsBetween(current.startDate, startDate)! : 0;
  const outside = plannedDays
    .map((d) => shiftDate(d, shift))
    .filter((d) => (startDate != null && d < startDate) || (endDate != null && d > endDate))
    .sort();
  if (outside.length) {
    const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    return {
      changed,
      error: `You have day plans that would fall outside the new dates (${outside.map(fmt).join(", ")}). Clear those days first, or keep the trip longer.`,
      shift: 0,
      startDate,
      endDate,
    };
  }
  return { changed, error: null, shift, startDate, endDate };
}
