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
}

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

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TripStore {
  state(): Promise<TripState>;
  savePreferences(p: Partial<Omit<Prefs, "set">>): Promise<Prefs>;
  setTripDates(p: { startDate?: string | null; endDate?: string | null; partySize?: number; title?: string | null }): Promise<TripMeta>;
  cities(): Promise<CityFacts[]>;
  places(cityId: string): Promise<PlaceInput[]>;
  searchPlaces(query: string, cityId?: string | null): Promise<PlaceInput[]>;
  graph(): Promise<Graph>;
  history(limit: number): Promise<ChatTurn[]>;
  append(role: "user" | "assistant", content: string, proposal?: Proposal | null): Promise<{ id: string }>;
  /** Writes the accepted proposal into the itinerary. The only path by
   *  which a plan changes. */
  applyProposal(p: Proposal): Promise<void>;
}

/** Nights between two ISO dates, or null. */
export function nightsBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}
