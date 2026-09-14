/** The planning engine's contract. Pure data in, pure data out — no
 *  framework, no network, no model (§04). */
import type { BookingRequirement, BudgetBand, CoverageTier, InterestTag, TravelPace, VerificationStatus } from "@/lib/types";

/** A place as the engine sees it: the places_public row plus its city's tier. */
export interface PlaceInput {
  id: string;
  cityId: string;
  name: string;
  /** Drives redundancy: the fourth shrine of a day scores lower than the first. */
  category: string;
  interestTags: InterestTag[];
  energy: number | null;
  crowdLevel: number | null;
  discovery: number | null;
  signature: number;
  physicalDemand: number | null;
  durationTasteMin: number | null;
  durationTypicalMin: number | null;
  durationFullMin: number | null;
  /** "before 08:00", "after 17:30" */
  bestWindow: string[];
  skipIf: string[];
  worthItIf: string[];
  costJpy: number | null;
  bookingReq: BookingRequirement;
  bookingLeadDays: number | null;
  /** "HH:MM"; null = always open */
  opensAt: string | null;
  closesAt: string | null;
  /** 0 = Sunday */
  closedWeekdays: number[];
  /** "YYYY-MM-DD" */
  closedDates: string[];
  conflictsWith: string[];
  pairsWith: string[];
  verificationStatus: VerificationStatus;
  coverageTier: CoverageTier;
  nearestStation: string | null;
  stationWalkMin: number | null;
  /** "koyo", "sakura" — when a place is at its best. Optional. */
  seasons?: string[];
  crowdNote?: string | null;
  localTip?: string | null;
}

/** The traveller for one city: preferences plus that city's budget band. */
export interface TravellerInput {
  pace: TravelPace;
  interestTags: InterestTag[];
  energy: number;
  crowdTolerance: number;
  discovery: number;
  /** Hard filter. "No beaches" means never. */
  excludes: string[];
  mobility: string[];
  budgetBand: BudgetBand | null;
}

export interface TravelLeg {
  mode: "rail" | "walk" | "ferry" | "bus" | "estimate";
  minutes: number;
  fareJpy: number;
  fareKind: "exact" | "estimate";
  /** One line a traveller can follow. */
  detail: string;
  lines: string[];
}

/** Door to door between two places, or null when the graph cannot say. */
export type TravelFn = (a: PlaceInput, b: PlaceInput) => TravelLeg | null;

/** Something the traveller pinned. Survives re-planning (§08). */
export interface LockedItem {
  placeId: string;
  /** Minutes since midnight, when the traveller fixed a time. */
  startMin?: number | null;
}

/** Scoring weights are configuration, not constants (§17 O3). */
export interface Weights {
  interestMatch: number;
  signature: number;
  confidence: number;
  seasonFit: number;
  discoveryFit: number;
  redundancy: number;
  crowd: number;
  energy: number;
  skipIf: number;
  budgetStrain: number;
  paceStrain: number;
  /** Score points a half hour of extra travel costs at the growth step. */
  travelPerHalfHour: number;
}

export interface DayInput {
  /** "YYYY-MM-DD" */
  date: string;
  cityId: string;
  places: PlaceInput[];
  traveller: TravellerInput;
  travel: TravelFn;
  locked?: LockedItem[];
  /** Places the traveller already holds a ticket for. */
  bookedPlaceIds?: string[];
  /** Places already planned on other days of the trip. */
  usedPlaceIds?: string[];
  /** Minutes since midnight. Default: 07:00 for a crowd-avoider, else 09:00. */
  dayStartMin?: number;
  weights?: Partial<Weights>;
  maxItems?: number;
}

export interface ScoreTerm {
  term: string;
  /** 0–1 input to the term. */
  value: number;
  weight: number;
  /** Signed: what it added to the total. */
  contribution: number;
  /** The clause this term earns in the shown reason, if any. */
  clause?: string;
}

export interface ScoreBreakdown {
  total: number;
  terms: ScoreTerm[];
}

export interface Alternative {
  placeId: string;
  name: string;
  score: number;
  whyNot: string;
}

export interface PlannedItem {
  placeId: string;
  name: string;
  category: string;
  startMin: number;
  endMin: number;
  durationMin: number;
  locked: boolean;
  score: ScoreBreakdown;
  /** True by construction: assembled from the terms that moved the score. */
  reason: string;
  reasonTerms: string[];
  /** How to get here from the previous stop. */
  arriveBy: TravelLeg | null;
  /** Next-best places for this slot, so "swap this" has something to offer. */
  alternatives: Alternative[];
  costJpy: number;
}

export type RejectStage = "filter" | "conflict" | "grow" | "validate";

/** Considered and left out — with the term that killed it. Showing why
 *  Arashiyama was left out is more convincing than any included stop. */
export interface Rejected {
  placeId: string;
  name: string;
  stage: RejectStage;
  term: string;
  detail: string;
}

export interface Meal {
  kind: "lunch";
  startMin: number;
  endMin: number;
}

export interface DayPlan {
  date: string;
  cityId: string;
  items: PlannedItem[];
  meals: Meal[];
  startMin: number;
  endMin: number;
  budgetMin: number;
  /** Time at places plus time moving. */
  activeMin: number;
  slackMin: number;
  placesJpy: number;
  faresJpy: number;
  costJpy: number;
  fareKind: "exact" | "estimate";
  considered: Rejected[];
  warnings: string[];
}
