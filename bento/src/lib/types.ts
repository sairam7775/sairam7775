/** Domain types shared by the app and (from P4) the planning engine.
 *  These mirror the migrations in supabase/migrations. */

export type CoverageTier = "deep" | "outline" | "stub";
export type VerificationStatus = "draft" | "verified";
export type TravelPace = "relaxed" | "standard" | "packed";
export type BudgetBand = "budget" | "mid" | "comfortable";
export type BookingRequirement = "none" | "recommended" | "required";
export type TripStatus = "planning" | "booked" | "travelling" | "done" | "abandoned";

export type BookingKind =
  | "flight"
  | "accommodation"
  | "transport"
  | "activity"
  | "restaurant"
  | "other";

/** What a traveller likes. Answers "what"; the style axes answer "how". */
export type InterestTag =
  | "shrines"
  | "food"
  | "nature"
  | "art"
  | "popculture"
  | "history"
  | "shopping"
  | "nightlife"
  | "onsen"
  | "offbeat";

export const INTEREST_TAGS: { id: InterestTag; label: string; hint: string }[] = [
  { id: "shrines", label: "Shrines & temples", hint: "Fushimi Inari, Todai-ji, Koyasan" },
  { id: "history", label: "History & castles", hint: "Himeji, Matsumoto, Hiroshima" },
  { id: "nature", label: "Nature & landscape", hint: "Gardens, gorges, mountains" },
  { id: "food", label: "Food & drink", hint: "Markets, izakaya, ramen, sake" },
  { id: "onsen", label: "Onsen", hint: "Hot springs and ryokan" },
  { id: "art", label: "Art & museums", hint: "Naoshima, teamLab, craft" },
  { id: "popculture", label: "Anime & pop culture", hint: "Akihabara, Ghibli, game centres" },
  { id: "shopping", label: "Shopping", hint: "Depachika, vintage, stationery" },
  { id: "nightlife", label: "Nightlife", hint: "Bars, live houses, late izakaya" },
  { id: "offbeat", label: "Off the beaten path", hint: "Places most visitors miss" },
];

/** How a traveller likes it. Continuous 0–1 axes.
 *
 *  These exist because a flat tag list cannot express "nature but not
 *  hiking" — the `nature` tag with a low `energy` value separates a garden
 *  from a mountain trail, and no tag could. */
export interface StyleAxes {
  /** 0 = sit and look at it · 1 = all-day physical effort */
  energy: number;
  /** 0 = will get up at 6am to avoid crowds · 1 = crowds don't matter */
  crowdTolerance: number;
  /** 0 = show me the famous things · 1 = show me what visitors miss */
  discovery: number;
}

export interface UserPreferences extends StyleAxes {
  userId: string;
  pace: TravelPace;
  interestTags: InterestTag[];
  /** Hard filter, not a scoring penalty. "No beaches" means never. */
  excludes: string[];
  mobility: string[];
  dietary: string[];
  displayCurrency: string;
}

export interface City {
  id: string;
  prefectureId: string;
  name: string;
  nameJa: string | null;
  coverageTier: CoverageTier;
  transitNote: string | null;
}

export interface Trip {
  id: string;
  userId: string;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  partySize: number;
  status: TripStatus;
  createdAt: string;
}

export interface TripCity {
  id: string;
  tripId: string;
  cityId: string;
  nights: number;
  arriveDate: string | null;
  departDate: string | null;
  sortOrder: number;
  /** Per city, not per trip: a ryokan night in Hakone must not make the
   *  Tokyo days score as overspending. */
  budgetBand: BudgetBand | null;
  reason: string | null;
}

/** How many active minutes a day holds, by pace. Read by the scheduler
 *  (P4) at step 1, before anything is scored. */
export const DAY_BUDGET_MINUTES: Record<TravelPace, number> = {
  relaxed: 360,
  standard: 480,
  packed: 600,
};

/** What each coverage tier lets the planner claim. */
export const TIER_BEHAVIOUR: Record<CoverageTier, string> = {
  deep: "Full day itineraries",
  outline: "Suggests places, won't claim a day plan is complete",
  stub: "Says plainly it doesn't know this place well enough yet",
};
