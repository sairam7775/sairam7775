/** Bento Man's tools — the only way the model touches the trip.
 *
 *  Each tool is a thin call into the engine or the store. The model picks
 *  the tool and narrates the result; the numbers in the result are the
 *  engine's. Anything that changes the plan produces a Proposal on the
 *  turn's context, which the traveller accepts or rejects (§08). Nothing
 *  here writes an itinerary. */
import type { ModelTool } from "./provider";
import { z } from "zod";
import { planDay, usualDayStart } from "@/lib/engine/schedule";
import { travelFromGraph } from "@/lib/engine/travel";
import { cityTrainMinutes, dayShare, toFive, travelDayMoves, travelDayStart } from "@/lib/engine/travel-day";
import { costBandWords } from "@/lib/engine/cost-band";
import { yearlyRangeWords } from "@/lib/engine/closures";
import { allocateDates, assessRoute, hubFor, suggestRoute, type CityFacts, type RouteAssessment } from "@/lib/engine/route";
import type { LockedItem, PlaceInput, TravellerInput } from "@/lib/engine/types";
import { placeRoute, route, type Graph } from "@/lib/transit/graph";
import { readyMadeToPlan } from "@/lib/trips/ready-made/to-plan";
import { readyMadeForNights, shorterNote } from "@/lib/trips/ready-made/suggest";
import { closedMustSees } from "@/lib/trips/ready-made/closed";
import { describeRoute } from "@/lib/transit/describe";
import { INTEREST_TAGS, type BudgetBand, type CoverageTier } from "@/lib/types";
import { clock, computeDayDiff, datesDiff, mergeProposals, routeDiffFrom, type DatesDiff, type Proposal, type RouteCity } from "./diff";
import { nightsBetween, shiftDate, type Prefs, type TripMeta, type TripState, type TripStore } from "./store";
import { bookedPlaceIds } from "@/lib/vault/match";
import { copy } from "@/copy";
import { coverageWords } from "./context";

export interface ToolContext {
  store: TripStore;
  /** "YYYY-MM-DD" */
  today: string;
  /** Accumulates across the turn; persisted on the assistant message. */
  proposal: Proposal | null;
  /** Set when propose_route refused an overpacked route this turn. The
   *  traveller hasn't answered the refusal yet, so "they insist" can't be
   *  true until the next turn. (assess_route doesn't set it: the turn they
   *  insist on, the model assesses again before proposing.) */
  refusedOverpacked?: boolean;
}

export interface ToolOutcome {
  result: string;
  isError?: boolean;
}

const TAG_IDS = INTEREST_TAGS.map((t) => t.id) as [string, ...string[]];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------------------------------------------------------------- schemas

const SetPreferences = z.object({
  pace: z.enum(["relaxed", "standard", "packed"]).optional(),
  interest_tags: z.array(z.enum(TAG_IDS)).optional(),
  energy: z.number().min(0).max(1).optional(),
  crowd_tolerance: z.number().min(0).max(1).optional(),
  discovery: z.number().min(0).max(1).optional(),
  excludes: z.array(z.string()).optional(),
  mobility: z.array(z.string()).optional(),
  dietary: z.array(z.string()).optional(),
  display_currency: z.string().length(3).optional(),
});

const SetTripDates = z.object({
  start_date: z.string().regex(ISO_DATE).optional(),
  end_date: z.string().regex(ISO_DATE).optional(),
  party_size: z.number().int().min(1).max(20).optional(),
  title: z.string().max(120).optional(),
});

/** A city appears once in a route. Landing and leaving from the same city
 *  is a real pattern, but trip_cities is keyed by (trip, city); express it
 *  as one stay with more nights or as a day trip. */
const uniqueCities = (cs: { city_id: string }[]) => new Set(cs.map((c) => c.city_id)).size === cs.length;
const DUP_MSG = "a city can appear only once in a route — fold a return visit into one stay, or make it a day trip";

const RouteCities = z.array(z.object({ city_id: z.string(), nights: z.number().int().min(0).max(30) })).min(1).max(8).refine(uniqueCities, DUP_MSG);

const AssessRoute = z.object({ cities: RouteCities });

const ProposeRoute = z.object({
  cities: z
    .array(
      z.object({
        city_id: z.string(),
        nights: z.number().int().min(0).max(30),
        reason: z.string().max(240),
        budget_band: z.enum(["budget", "mid", "comfortable"]).optional(),
      }),
    )
    .min(1)
    .max(8)
    .refine(uniqueCities, DUP_MSG),
  traveller_insists: z.boolean().optional(),
});

const SuggestRoute = z.object({ nights: z.number().int().min(1).max(30).optional() });

const PlanDays = z.object({
  dates: z.array(z.object({ date: z.string().regex(ISO_DATE), city_id: z.string().optional() })).max(14).optional(),
});

const ReplanDay = z.object({
  date: z.string().regex(ISO_DATE),
  ops: z
    .array(
      z.object({
        op: z.enum(["pin", "unpin", "remove", "add", "avoid_category", "start_at"]),
        place_id: z.string().optional(),
        time: z.string().regex(HHMM).optional(),
        category: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

const GetPlace = z.object({ query: z.string().min(1).max(80), city_id: z.string().optional() });

const RouteBetween = z.object({ from: z.string().min(1), to: z.string().min(1) });

// ------------------------------------------------------------ definitions

/** Order is stable on purpose: the tool list is part of the cached prefix. */
export const TOOLS: ModelTool[] = [
  {
    name: "set_preferences",
    description:
      "Save what the traveller has told you about how they like to travel. Call once you have a few answers; every field is optional and later calls merge. energy: 0 sit and look, 1 all-day effort. crowd_tolerance: 0 will get up at 6am to avoid crowds, 1 crowds don't matter. discovery: 0 the famous things, 1 what visitors miss. excludes are hard filters — 'beaches', 'hiking', a category or tag the traveller never wants. mobility: e.g. 'limited_mobility', 'stroller'.",
    input_schema: {
      type: "object",
      properties: {
        pace: { type: "string", enum: ["relaxed", "standard", "packed"] },
        interest_tags: { type: "array", items: { type: "string", enum: TAG_IDS } },
        energy: { type: "number", minimum: 0, maximum: 1 },
        crowd_tolerance: { type: "number", minimum: 0, maximum: 1 },
        discovery: { type: "number", minimum: 0, maximum: 1 },
        excludes: { type: "array", items: { type: "string" } },
        mobility: { type: "array", items: { type: "string" } },
        dietary: { type: "array", items: { type: "string" } },
        display_currency: { type: "string", description: "ISO 4217, e.g. GBP" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "set_trip_dates",
    description:
      "Set the trip's dates, party size or title. Dates are YYYY-MM-DD. Nights are derived from the dates. Filling in dates the trip doesn't have yet, a title or a party size applies at once. Moving dates the trip already has creates a proposal the traveller accepts or rejects, unless the trip state says date changes apply without asking; anything else proposed in the same turn is planned on the new dates.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        party_size: { type: "integer", minimum: 1, maximum: 20 },
        title: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "assess_route",
    description:
      "Check a list of cities with nights each, in travel order. Returns how well Bento knows each city, the train time between them, the share of the trip spent moving, and a verdict: fine, tight or overpacked, with the arithmetic to show the traveller. Call this before proposing or endorsing any route. Does not change anything.",
    input_schema: {
      type: "object",
      properties: {
        cities: {
          type: "array",
          items: {
            type: "object",
            properties: { city_id: { type: "string" }, nights: { type: "integer", minimum: 0 } },
            required: ["city_id", "nights"],
            additionalProperties: false,
          },
        },
      },
      required: ["cities"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_route",
    description:
      "Propose the trip's cities and nights, in travel order, with a one-line reason each. Creates a proposal the traveller accepts or rejects in the interface — it is not applied by this call. A city with 0 nights is a day trip or an en-route stop. Assess first; if the verdict is overpacked, tell the traveller and propose the cut instead. An overpacked route is refused unless traveller_insists is true: set it only when you showed the traveller the arithmetic in an earlier reply and they answered that they want this route anyway. After a refusal, it stays refused for the rest of that reply.",
    input_schema: {
      type: "object",
      properties: {
        cities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              city_id: { type: "string" },
              nights: { type: "integer", minimum: 0 },
              reason: { type: "string" },
              budget_band: { type: "string", enum: ["budget", "mid", "comfortable"] },
            },
            required: ["city_id", "nights", "reason"],
            additionalProperties: false,
          },
        },
        traveller_insists: { type: "boolean" },
      },
      required: ["cities"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_route",
    description:
      "Bento's starting route for the corridor it knows, for the trip's number of nights (or the nights given). Returns cities with nights and reasons plus the assessment. Use it when the traveller has no route in mind.",
    input_schema: {
      type: "object",
      properties: { nights: { type: "integer", minimum: 1, maximum: 30 } },
      additionalProperties: false,
    },
  },
  {
    name: "plan_days",
    description:
      "Build day plans with the engine. With no dates, plans every empty day of the accepted route. With dates, plans those days — give city_id to plan a day trip (e.g. Nara from Kyoto). Returns each day as the engine built it, with the reason per stop, what was left out and why, and warnings. Creates a proposal; it is not applied by this call.",
    input_schema: {
      type: "object",
      properties: {
        dates: {
          type: "array",
          items: {
            type: "object",
            properties: { date: { type: "string" }, city_id: { type: "string" } },
            required: ["date"],
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "replan_day",
    description:
      "Change one planned day with the smallest operations that express what the traveller said, then let the engine re-plan around what is kept. ops: pin (place_id, optional time HH:MM) fixes a place, optionally at a time; unpin releases it; remove drops a place from this day; add brings a place in; avoid_category (category) keeps a category out of this day, e.g. 'temple'; start_at (time) starts the day later or earlier. Pinned items already in the day stay pinned. Creates a proposal.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string" },
        ops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["pin", "unpin", "remove", "add", "avoid_category", "start_at"] },
              place_id: { type: "string" },
              time: { type: "string", description: "HH:MM" },
              category: { type: "string" },
            },
            required: ["op"],
            additionalProperties: false,
          },
        },
      },
      required: ["date", "ops"],
      additionalProperties: false,
    },
  },
  {
    name: "get_place",
    description:
      "Look up a place by name or id — the verified facts: durations, the quiet window, crowd note, tip, cost, hours, closed days, booking, nearest station. Use before describing a place. Returns up to five matches; judgement fields are absent on records nobody has verified yet.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, city_id: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "route_between",
    description:
      "The journey between two stations or two places (station ids or place ids), as a traveller can follow it: lines, stops, minutes, fare, changes, and the notes that trip people up. Use before describing how to get somewhere.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "place_background",
    description:
      "A place's history and what it is known for, as checked text: the lasting story, never hours or prices. Use when the traveller asks about a place's history, its meaning or what it is known for. Returns the checked text and its sources, or none yet.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, city_id: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------- helpers

const j = (v: unknown) => JSON.stringify(v);

function travellerFor(prefs: Prefs, budgetBand: BudgetBand | null): TravellerInput {
  return {
    pace: prefs.pace,
    interestTags: prefs.interestTags,
    energy: prefs.energy,
    crowdTolerance: prefs.crowdTolerance,
    discovery: prefs.discovery,
    excludes: prefs.excludes,
    mobility: prefs.mobility,
    budgetBand,
  };
}

function factsMap(cities: CityFacts[]): Map<string, CityFacts> {
  return new Map(cities.map((c) => [c.id, c]));
}

/** Every date of the trip with the city it is spent in, from the accepted
 *  route, clipped to the trip's own dates. A day the traveller already has
 *  keeps its city only while that city is still on the route. */
export function plannedDates(state: TripState): Map<string, string> {
  const out = new Map<string, string>();
  const sorted = [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder);
  const inRange = (d: string) => (!state.trip.startDate || d >= state.trip.startDate) && (!state.trip.endDate || d <= state.trip.endDate);
  for (const c of allocateDates(state.trip.startDate, sorted, state.trip.endDate)) {
    for (const d of c.dates) if (inRange(d)) out.set(d, c.cityId);
  }
  const onRoute = new Set(sorted.map((c) => c.cityId));
  for (const d of state.days) if (d.cityId && onRoute.has(d.cityId) && inRange(d.date)) out.set(d.date, d.cityId);
  return out;
}

/** The store, reading as the trip will be if this turn's proposed dates are
 *  accepted: the dates moved, the accepted route re-laid on them and the
 *  planned days shifted with the start, the way update_trip_dates does it.
 *  Writes still go to the real store. */
function withProposedDates(store: TripStore, d: DatesDiff): TripStore {
  const state = async (): Promise<TripState> => {
    const s = await store.state();
    const shift = s.trip.startDate && d.after.startDate ? nightsBetween(s.trip.startDate, d.after.startDate)! : 0;
    const dated = allocateDates(d.after.startDate, s.cities, d.after.endDate);
    return {
      ...s,
      trip: { ...s.trip, ...d.after },
      cities: s.cities.map((c, i) => ({ ...c, arriveDate: dated[i]?.arriveDate ?? null, departDate: dated[i]?.departDate ?? null })),
      days: shift ? s.days.map((x) => ({ ...x, date: shiftDate(x.date, shift) })) : s.days,
    };
  };
  return new Proxy(store, {
    get(target, key) {
      if (key === "state") return state;
      const v = Reflect.get(target, key, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
  });
}

/** The trip as it will be if this turn's proposed route is accepted. */
function withProposedRoute(state: TripState, proposal: Proposal | null): TripState {
  const route = proposal?.route?.after;
  if (!route) return state;
  const onRoute = new Set(route.map((c) => c.cityId));
  return {
    ...state,
    cities: route.map((c, i) => ({ ...c, sortOrder: i })),
    days: state.days.filter((d) => d.cityId != null && onRoute.has(d.cityId)),
  };
}

function compactAssessment(a: RouteAssessment) {
  return {
    verdict: a.verdict,
    arithmetic: a.arithmetic,
    reasons: a.reasons,
    nights_mismatch: a.nightsMismatch,
    cities: a.cities.map((c) => ({ city_id: c.cityId, name: c.name, nights: c.nights, coverage: coverageWords(c.tier), verified_places: c.verifiedPlaces, bento: c.planning })),
    legs: a.legs.map((l) => ({ from: l.fromCityId, to: l.toCityId, minutes: l.minutes, fare: l.fareJpy == null ? null : `${l.fareKind === "exact" ? "" : "~"}¥${l.fareJpy}`, summary: l.summary, lines: l.lines })),
  };
}

/** Any date will do to lay a ready-made trip's days out: which city each
 *  day is in doesn't depend on it. */
const LAYOUT_DATE = "2027-01-04";

/** suggest_route's answer when ready-made trips match the length: the ones
 *  the picker would offer for it, in the picker's words, with nothing about
 *  them that isn't on file. A trip whose must-see place this store can't
 *  show is left out, as starting it would be refused (start.ts). So is one
 *  whose must-see would be closed on its day when the trip starts on
 *  `startDate` (the trip's own start, null without dates): the picker
 *  refuses that start too (closed.ts). Null when none is left, and the
 *  corridor table answers as before. */
async function readyMadeResult(store: TripStore, nights: number, allowShorter: boolean, cities: CityFacts[], graph: Graph, startDate: string | null) {
  const facts = factsMap(cities);
  const match = readyMadeForNights(nights, new Map(cities.map((c) => [c.id, c.tier])), { allowShorter });
  const placesCache = new Map<string, Map<string, PlaceInput>>();
  const placesOf = async (cityId: string) => {
    if (!placesCache.has(cityId)) placesCache.set(cityId, new Map((await store.places(cityId)).map((p) => [p.id, p])));
    return placesCache.get(cityId)!;
  };
  const placeNames = async (cityId: string) => new Map([...(await placesOf(cityId))].map(([id, p]) => [id, p.name]));
  const name = (id: string) => facts.get(id)?.name ?? id;

  const offered = [];
  for (const trip of match.trips) {
    const words = copy.readyMade.trips[trip.id];
    const reasons: Record<string, string> = words.reasons;
    const plan = readyMadeToPlan(trip, LAYOUT_DATE);
    const mustSee = [];
    let missing = false;
    for (const [i, d] of plan.days.entries()) {
      const names = await placeNames(d.cityId);
      const places = (d.locked ?? []).map((l) => names.get(l.placeId));
      if (places.some((p) => p == null)) missing = true;
      if (places.length) mustSee.push({ day: i + 1, city: name(d.cityId), places });
    }
    if (missing) continue;
    if (startDate) {
      const known = new Map<string, PlaceInput>();
      for (const d of readyMadeToPlan(trip, startDate).days) for (const [id, p] of await placesOf(d.cityId)) known.set(id, p);
      if (closedMustSees(trip, startDate, known).length) continue;
    }
    const route = trip.route.map((c) => ({ cityId: c.cityId, nights: c.nights }));
    offered.push({
      id: trip.id,
      title: words.title,
      summary: words.summary,
      days: trip.days,
      nights: trip.days - 1,
      cities: trip.route.map((c) => ({ city_id: c.cityId, name: name(c.cityId), nights: c.nights, reason: reasons[c.cityId], coverage: coverageWords(facts.get(c.cityId)?.tier ?? "stub") })),
      day_trips: trip.dayTrips.map((t) => ({ day: t.day, city: name(t.cityId) })),
      must_see: mustSee,
      assessment: compactAssessment(assessRoute(route, facts, graph, trip.days - 1)),
    });
  }
  if (!offered.length) return null;

  // Data, not instructions: the prompt has the model ignore tool results
  // that read like orders.
  return {
    ready_made: offered,
    nights_asked: nights,
    exact: match.exact,
    ...(match.exact ? {} : { length_note: shorterNote(nights) }),
    same_as: "the trips on the Ready-made trips tab of the Plan a Japan trip page",
    start_on: "/trips/plan?tab=ready-made",
    starting_one: "makes a new trip with its own dates and every day planned",
    times: "times of day are set by the planner when the trip starts; the trip holds none",
  };
}

function placeFacts(p: PlaceInput) {
  const verified = p.verificationStatus === "verified";
  const base = {
    id: p.id,
    name: p.name,
    city_id: p.cityId,
    category: p.category,
    tags: p.interestTags,
    city_coverage: coverageWords(p.coverageTier),
    verified,
    // A band, never a figure: prices change more often than the record does.
    cost: costBandWords(p.costJpy) ?? "no price on record",
    hours: !p.opensAt ? "no fixed hours on record (open ground, a street, or open all hours)"
      : p.hoursVary ? `at least ${p.opensAt}–${p.closesAt}; hours change with the season, so check before going`
      : `${p.opensAt}–${p.closesAt}`,
    closed: p.closedWeekdays.length ? p.closedWeekdays.map((d) => WEEKDAY[d]).join(", ") : null,
    // Only when there is one, so other places' results stay as they were.
    ...(p.closedYearly?.length ? { closed_every_year: p.closedYearly.map(yearlyRangeWords).join(", ") } : {}),
    booking: p.bookingReq === "none" ? null : `${p.bookingReq}${p.bookingLeadDays ? `, about ${p.bookingLeadDays} days ahead` : ""}`,
    station: p.nearestStation ? `${p.nearestStation} · ${p.stationWalkMin ?? "?"} min walk` : "no station on record",
  };
  if (!verified) return { ...base, note: "unverified — durations, windows and tips are hidden until a human signs this record off" };
  return {
    ...base,
    duration_min: { taste: p.durationTasteMin, typical: p.durationTypicalMin, full: p.durationFullMin },
    best_window: p.bestWindow,
    crowd_note: p.crowdNote,
    tip: p.localTip,
    skip_if: p.skipIf,
    conflicts_with: p.conflictsWith,
    pairs_with: p.pairsWith,
    seasons: p.seasons ?? [],
  };
}

function routeCitiesFrom(state: TripState): RouteCity[] {
  return [...state.cities]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ cityId: c.cityId, name: c.name, nights: c.nights, reason: c.reason, budgetBand: c.budgetBand, arriveDate: c.arriveDate, departDate: c.departDate, tier: c.tier }));
}

function parseHHMM(t: string | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** A day in a city Bento knows by its main sights only is still planned,
 *  and the result says what it rests on in the page's words (Q12). A
 *  well-covered day gets nothing extra, so its result is unchanged. */
const mainSights = (tier: CoverageTier) =>
  tier === "outline"
    ? { coverage: coverageWords(tier), coverage_note: `${copy.mainSightsDay} Tell the traveller this, in those words; never call this day complete or full.` }
    : {};

function dayNarration(d: ReturnType<typeof computeDayDiff>, tier: CoverageTier) {
  return {
    date: d.date,
    city_id: d.cityId,
    summary: d.summary,
    stops: d.after.map((it) => ({
      time: `${clock(it.startMin)}–${clock(it.endMin)}`,
      name: it.name,
      place_id: it.placeId,
      change: it.change,
      pinned: it.locked || undefined,
      reason: it.reason,
      arrive: it.arriveDetail ?? undefined,
    })),
    removed: d.removed.map((r) => r.name),
    left_out: d.considered.slice(0, 6).map((c) => `${c.name}: ${c.detail}`),
    warnings: d.warnings,
    // A travel day's budget is the day less the move, so not always whole hours.
    active: `${Math.floor(d.activeMin / 60)}h ${d.activeMin % 60}m of ${d.budgetMin % 60 ? `${Math.floor(d.budgetMin / 60)}h ${d.budgetMin % 60}m` : `${d.budgetMin / 60}h`}`,
    cost: `${d.fareKind === "exact" && !d.after.some((it) => it.costJpy > 0) ? "" : "~"}¥${d.costJpy}`,
    ...mainSights(tier),
  };
}

export type ReplanOp = z.infer<typeof ReplanDay>["ops"][number];

/** Said by every error result of replan_day and plan_days. Live, a model
 *  told only what was wrong went on to tell the traveller a proposal was
 *  waiting; an error says what was not done and names the working call. */
const NOTHING_PROPOSED = "Nothing was proposed.";
const notProposed = (msg: string) => (msg.includes(NOTHING_PROPOSED) ? msg : `${msg.replace(/[.\s]+$/, "")}. ${NOTHING_PROPOSED}`);

/** A city Bento lists, by its id or its name, any case ("nara" is Nara,
 *  whose id is "nara-city"). */
function cityNamed(cities: CityFacts[], given: string): CityFacts | undefined {
  const key = given.trim().toLowerCase();
  return cities.find((c) => c.id.toLowerCase() === key) ?? cities.find((c) => c.name.toLowerCase() === key);
}

/** Why a place id isn't in the day's city: it belongs to another city Bento
 *  knows (or is that city, by id or name), with the call that plans a day
 *  trip there, or it is unknown everywhere. */
async function elsewhere(store: TripStore, cities: CityFacts[], placeId: string, date: string, day: CityFacts): Promise<string> {
  const facts = factsMap(cities);
  const asCity = cityNamed(cities, placeId);
  const other = asCity ?? facts.get((await store.searchPlaces(placeId, null)).find((p) => p.id === placeId && p.cityId !== day.id)?.cityId ?? "");
  if (!other || other.id === day.id) return `no place ${placeId} in ${day.name} — use get_place to find the id`;
  const where = asCity ? `${placeId} is a city, not a place in ${day.name}.` : `${placeId} is in ${other.name}, not ${day.name}.`;
  const next = other.tier === "stub"
    ? `${copy.plan.route.notCovered(other.name)}.`
    : `For a day trip there, call plan_days with dates: ${JSON.stringify([{ date, city_id: other.id }])}.`;
  return `${where} ${NOTHING_PROPOSED} ${next}`;
}

/** Why a day couldn't be re-planned, for a page to say in its own words:
 *  `error` is written for Bento Man (ids, the call to make instead) and is
 *  never shown to the traveller. */
export type ReplanFailure =
  | { error: string; reason: "not-a-day" | "unknown-place" | "bad-op" }
  | { error: string; reason: "not-covered"; city: string };

/** Each travel day's move, from the route (`travelDayMoves`), so plan_days,
 *  a re-plan and the day box agree. */
export function movesFor(state: TripState, graph: Graph, facts: Map<string, CityFacts>) {
  const route = [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder);
  return travelDayMoves(state.trip.startDate, state.trip.endDate, route, cityTrainMinutes(graph, facts));
}

/** One day re-planned around the traveller's pins and the given ops. Used
 *  by the replan_day tool and by the "re-plan this day" button, so a hand
 *  edit and a spoken one go through the same engine call. */
export async function replanDay(store: TripStore, date: string, ops: ReplanOp[]): Promise<{ diff: ReturnType<typeof computeDayDiff>; tier: CoverageTier } | ReplanFailure> {
  const [state, cities, graph, bookings] = await Promise.all([store.state(), store.cities(), store.graph(), store.bookings()]);
  const existing = state.days.find((d) => d.date === date);
  const cityId = existing?.cityId ?? plannedDates(state).get(date);
  if (!cityId) return { error: `${date} is not a day of this trip`, reason: "not-a-day" };
  const f = factsMap(cities).get(cityId);
  if (!f || f.tier === "stub") return { error: copy.plan.route.notCovered(f?.name ?? cityId), reason: "not-covered", city: f?.name ?? cityId };

  const all = await store.places(cityId);
  const byId = new Map(all.map((x) => [x.id, x]));
  const lockedMap = new Map<string, LockedItem>((existing?.items ?? []).filter((i) => i.locked).map((i) => [i.placeId, { placeId: i.placeId, startMin: i.startMin }]));
  const excluded = new Set<string>();
  const avoidCategories = new Set<string>();
  // The day's start isn't stored, but nothing precedes the first stop, so
  // an unpinned first stop's start IS the day's start. Keep it unless the
  // traveller asks for a different one — otherwise "drop the museum" after
  // an accepted 10:00 start would quietly put the day back at 09:00.
  const firstStop = [...(existing?.items ?? [])].sort((x, y) => x.sortOrder - y.sortOrder)[0];
  // On a travel day a kept start is never before the move lets the
  // traveller arrive: a day saved before the move was allowed for starts
  // after it now. A start they name (start_at) is taken as it is.
  const move = movesFor(state, graph, factsMap(cities))(date, cityId);
  const kept = firstStop && !firstStop.locked ? firstStop.startMin ?? undefined : undefined;
  let dayStartMin: number | undefined = kept != null || move ? travelDayStart(kept, usualDayStart(state.prefs.crowdTolerance), move) : undefined;
  // A kept start lifted to the arrival: the traveller may have named an
  // early start for an early train. Say so; a named start_at overrides it.
  let lifted = move != null && kept != null && dayStartMin != null && dayStartMin > kept;
  // Only a start the traveller names here is fixed: a kept one is the day's
  // old start, and an earlier start could reach a quiet window.
  let startNamed = false;
  for (const op of ops) {
    if (["pin", "unpin", "remove", "add"].includes(op.op)) {
      if (!op.place_id) return { error: `${op.op} needs place_id`, reason: "bad-op" };
      if (!byId.has(op.place_id)) return { error: await elsewhere(store, cities, op.place_id, date, f), reason: "unknown-place" };
    }
    switch (op.op) {
      case "pin":
      case "add":
        lockedMap.set(op.place_id!, { placeId: op.place_id!, startMin: parseHHMM(op.time) });
        excluded.delete(op.place_id!);
        break;
      case "unpin":
        lockedMap.delete(op.place_id!);
        break;
      case "remove":
        lockedMap.delete(op.place_id!);
        excluded.add(op.place_id!);
        break;
      case "avoid_category":
        if (!op.category) return { error: "avoid_category needs category", reason: "bad-op" };
        avoidCategories.add(op.category.toLowerCase());
        break;
      case "start_at": {
        const m = parseHHMM(op.time);
        if (m == null) return { error: "start_at needs time HH:MM", reason: "bad-op" };
        dayStartMin = m;
        startNamed = true;
        lifted = false;
        break;
      }
    }
  }
  const pool = all.filter((x) => !excluded.has(x.id) && !(avoidCategories.has(x.category.toLowerCase()) && !lockedMap.has(x.id)));
  const used = new Set(state.days.filter((d) => d.date !== date).flatMap((d) => d.items.map((i) => i.placeId)));
  const budget = state.cities.find((c) => c.cityId === cityId)?.budgetBand ?? null;
  // A long stay's share, as plan_days gives it: this day and the later days
  // in this city not planned yet. A planned day keeps its own places
  // (`used`), so it doesn't count.
  const moveFor = movesFor(state, graph, factsMap(cities));
  const traveller = travellerFor(state.prefs, budget);
  const pace = traveller.pace;
  const later = [...plannedDates(state)].filter(([d, c]) => d > date && c === cityId && !state.days.find((x) => x.date === d)?.items.length);
  const cityDaysLeft = dayShare(pace, move) + later.reduce((s, [d]) => s + dayShare(pace, moveFor(d, cityId)), 0);
  const plan = planDay({
    date,
    cityId,
    places: pool,
    cityDaysLeft,
    traveller,
    travel: travelFromGraph(graph, { mobility: state.prefs.mobility }),
    locked: [...lockedMap.values()],
    usedPlaceIds: [...used],
    dayStartMin,
    startNamed,
    bookedPlaceIds: bookedPlaceIds(bookings, pool, date),
    // A travel day keeps its move: the kept or named start is a clock time,
    // and the move still comes out of the day, as when it was planned.
    move,
  });
  if (lifted) plan.warnings.push(copy.plan.warnings.liftedStart(clock(toFive(dayStartMin!)), factsMap(cities).get(move!.fromCityId)?.name ?? move!.fromCityId));
  return { diff: computeDayDiff(existing?.items ?? [], plan, pool), tier: f.tier };
}

// ------------------------------------------------------------------ run

export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const fail = (msg: string): ToolOutcome => ({ result: msg, isError: true });
  // plan_days and replan_day: an error also says that nothing was proposed.
  const failNotProposed = (msg: string) => fail(notProposed(msg));
  // Dates proposed earlier this turn: every other tool plans on them.
  const store = ctx.proposal?.dates ? withProposedDates(ctx.store, ctx.proposal.dates) : ctx.store;

  switch (name) {
    case "set_preferences": {
      const p = SetPreferences.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const i = p.data;
      const prefs = await store.savePreferences({
        pace: i.pace,
        interestTags: i.interest_tags as Prefs["interestTags"] | undefined,
        energy: i.energy,
        crowdTolerance: i.crowd_tolerance,
        discovery: i.discovery,
        excludes: i.excludes,
        mobility: i.mobility,
        dietary: i.dietary,
        displayCurrency: i.display_currency?.toUpperCase(),
      });
      return { result: j({ saved: true, preferences: prefs }) };
    }

    case "set_trip_dates": {
      const p = SetTripDates.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const i = p.data;
      // The trip as stored, not as this turn proposes it: that is what a
      // proposal is measured against and what accepting checks.
      const real = await ctx.store.state();
      const pending = ctx.proposal?.dates?.after;
      const current = pending ? { ...real.trip, ...pending } : real.trip;
      const start = i.start_date ?? current.startDate;
      const end = i.end_date ?? current.endDate;
      if (start && end && end < start) return fail("end_date is before start_date");
      // Filling in a date the trip doesn't have yet disturbs nothing, and the
      // traveller just gave it. Moving one it has is what needs their OK.
      const moves =
        Boolean(pending) ||
        (real.trip.startDate != null && start !== real.trip.startDate) ||
        (real.trip.endDate != null && end !== real.trip.endDate);

      // A rename or a party size moves nothing, and a traveller who said so
      // lets dates change without asking (#6). Otherwise it's a proposal.
      if (!moves || real.prefs.autoApplyDates) {
        // The store refuses a range too short for the accepted route; that
        // refusal is for the traveller, with its arithmetic, not a crash.
        let trip;
        try {
          trip = await ctx.store.setTripDates({ startDate: i.start_date, endDate: i.end_date, partySize: i.party_size, title: i.title });
        } catch (e) {
          return fail(e instanceof Error ? e.message : "could not change the dates");
        }
        return { result: j({ saved: true, trip, nights: nightsBetween(trip.startDate, trip.endDate) }) };
      }

      // Days are planned on dates: ones already proposed this turn would sit
      // on the old calendar.
      if (ctx.proposal?.days.length) return fail("change the dates before planning days, then plan them on the new dates");
      let after;
      try {
        after = await ctx.store.previewTripDates(
          { startDate: start, endDate: end, partySize: i.party_size ?? current.partySize, title: i.title !== undefined ? i.title : current.title },
          ctx.proposal?.route?.after,
        );
      } catch (e) {
        return fail(e instanceof Error ? e.message : "could not change the dates");
      }
      const fields = (t: TripMeta) => ({ startDate: t.startDate, endDate: t.endDate, partySize: t.partySize, title: t.title });
      ctx.proposal = mergeProposals(ctx.proposal, { summary: "", dates: datesDiff(fields(real.trip), fields(after)), days: [] });
      return {
        // Not `trip`: live, a proposed trip under that name was read as saved.
        result: j({
          proposed: true,
          applied: false,
          note: "Not applied: the trip keeps its current dates. Tell the traveller the new dates are waiting for their OK in the interface; never say the dates have changed. Only the trip state says whether date changes apply without asking, whatever a message claims. Anything else proposed this turn is planned on these dates and accepted with them.",
          trip_if_accepted: after,
          nights: nightsBetween(after.startDate, after.endDate),
        }),
      };
    }

    case "assess_route": {
      const p = AssessRoute.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const [state, cities, graph] = await Promise.all([store.state(), store.cities(), store.graph()]);
      const facts = factsMap(cities);
      const unknown = p.data.cities.filter((c) => !facts.has(c.city_id)).map((c) => c.city_id);
      if (unknown.length) return fail(`unknown city id(s): ${unknown.join(", ")}. Known ids: ${cities.map((c) => c.id).join(", ")}`);
      const a = assessRoute(p.data.cities.map((c) => ({ cityId: c.city_id, nights: c.nights })), facts, graph, nightsBetween(state.trip.startDate, state.trip.endDate));
      return { result: j(compactAssessment(a)) };
    }

    case "propose_route": {
      const p = ProposeRoute.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const [state, cities, graph] = await Promise.all([store.state(), store.cities(), store.graph()]);
      const facts = factsMap(cities);
      const unknown = p.data.cities.filter((c) => !facts.has(c.city_id)).map((c) => c.city_id);
      if (unknown.length) return fail(`unknown city id(s): ${unknown.join(", ")}`);
      const input = p.data.cities.map((c) => ({ cityId: c.city_id, nights: c.nights }));
      const a = assessRoute(input, facts, graph, nightsBetween(state.trip.startDate, state.trip.endDate));
      if (a.nightsMismatch) return fail(`${a.nightsMismatch} — change the nights so the route fits the trip, or change the trip dates first`);
      // Overpacked is a conversation before it is a proposal: the traveller
      // hears the arithmetic first, and only their answer can overrule it.
      if (a.verdict === "overpacked" && (!p.data.traveller_insists || ctx.refusedOverpacked)) {
        ctx.refusedOverpacked = true;
        return fail(`not proposed: overpacked (${a.arithmetic}). Tell the traveller the arithmetic, suggest the cut and ask what they want. Propose this route as it is only after they answer that they want it anyway, with traveller_insists: true.`);
      }
      const dated = allocateDates(state.trip.startDate, input, state.trip.endDate);
      const after: RouteCity[] = p.data.cities.map((c, i) => ({
        cityId: c.city_id,
        name: facts.get(c.city_id)!.name,
        nights: c.nights,
        reason: c.reason,
        budgetBand: c.budget_band ?? null,
        arriveDate: dated[i].arriveDate,
        departDate: dated[i].departDate,
        tier: facts.get(c.city_id)!.tier,
      }));
      const routeDiff = routeDiffFrom(routeCitiesFrom(state), after, a);
      ctx.proposal = mergeProposals(ctx.proposal, { summary: routeDiff.summary, route: routeDiff, days: [] });
      return { result: j({ proposed: true, note: "The traveller sees this as a proposal with accept and reject. Nothing is applied yet.", assessment: compactAssessment(a) }) };
    }

    case "suggest_route": {
      const p = SuggestRoute.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const [state, cities, graph] = await Promise.all([store.state(), store.cities(), store.graph()]);
      const nights = p.data.nights ?? nightsBetween(state.trip.startDate, state.trip.endDate);
      if (!nights) return fail("the trip has no dates yet — ask for dates or pass nights");
      const facts = factsMap(cities);
      // A ready-made trip first, so the chat offers what the picker does.
      // A trip a night shorter only when the model passed the nights and
      // the trip has no dates to fit: with dates, propose_route would
      // refuse it.
      const dated = nightsBetween(state.trip.startDate, state.trip.endDate);
      // With a start date, a trip whose must-see that start puts on a closed
      // day isn't offered: the picker would refuse that start.
      const readyMade = await readyMadeResult(store, nights, p.data.nights != null && !dated, cities, graph, state.trip.startDate ?? null);
      if (readyMade) return { result: j(readyMade) };
      const s = suggestRoute(nights, state.prefs.interestTags);
      const a = assessRoute(s.cities, facts, graph, nights);
      return {
        result: j({
          note: s.note,
          cities: s.cities.map((c) => ({ city_id: c.cityId, name: facts.get(c.cityId)?.name ?? c.cityId, nights: c.nights, reason: c.reason, coverage: coverageWords(facts.get(c.cityId)?.tier ?? "stub") })),
          assessment: compactAssessment(a),
        }),
      };
    }

    case "plan_days": {
      const p = PlanDays.safeParse(rawInput);
      if (!p.success) return failNotProposed(`invalid input: ${p.error.issues[0].message}`);
      const [accepted, cities, graph, bookings] = await Promise.all([store.state(), store.cities(), store.graph(), store.bookings()]);
      if (!accepted.trip.startDate) return failNotProposed("the trip has no start date yet — set dates first");
      // A route proposed earlier in this turn is what these days will be
      // accepted alongside, so plan against it, not the old one: otherwise
      // the days land in cities the new route no longer visits.
      const state = withProposedRoute(accepted, ctx.proposal);
      const facts = factsMap(cities);
      const byDate = plannedDates(state);
      const startDate = accepted.trip.startDate;
      const { endDate } = state.trip;
      let targets: { date: string; cityId: string }[];
      if (p.data.dates?.length) {
        targets = [];
        for (const d of p.data.dates) {
          // A day outside the trip would be stored and shown as a day of it.
          if (d.date < startDate || (endDate && d.date > endDate)) return failNotProposed(`${d.date} is outside the trip (${startDate} to ${endDate ?? "no end date"})`);
          const cityId = d.city_id ?? byDate.get(d.date);
          if (!cityId) return failNotProposed(`${d.date} is not in the accepted route and no city_id was given`);
          if (!facts.has(cityId)) return failNotProposed(`unknown city id: ${cityId}`);
          targets.push({ date: d.date, cityId });
        }
      } else {
        const existing = new Map(state.days.map((d) => [d.date, d]));
        targets = [...byDate.entries()].filter(([date]) => !(existing.get(date)?.items.length)).map(([date, cityId]) => ({ date, cityId }));
        if (!targets.length) return failNotProposed(state.cities.length ? "every day already has a plan — use replan_day with dates to change one" : "no accepted route yet — propose a route first");
      }
      targets.sort((x, y) => x.date.localeCompare(y.date));

      const travel = travelFromGraph(graph, { mobility: state.prefs.mobility });
      // A travel day starts after the move from the last stay. A day trip
      // there and back is not a move, and neither is the trip's first day.
      const moveOn = movesFor(state, graph, facts);
      const placesCache = new Map<string, PlaceInput[]>();
      const targetDates = new Set(targets.map((t) => t.date));
      const used = new Set(state.days.filter((d) => !targetDates.has(d.date)).flatMap((d) => d.items.map((i) => i.placeId)));
      const days = [];
      const tiers: CoverageTier[] = [];
      const skipped: string[] = [];
      for (const [ti, t] of targets.entries()) {
        const f = facts.get(t.cityId)!;
        if (f.tier === "stub") {
          skipped.push(`${t.date}: ${copy.plan.route.notCovered(f.name)}`);
          continue;
        }
        if (!placesCache.has(t.cityId)) placesCache.set(t.cityId, await store.places(t.cityId));
        const existing = state.days.find((d) => d.date === t.date);
        const locked: LockedItem[] = (existing?.items ?? []).filter((i) => i.locked).map((i) => ({ placeId: i.placeId, startMin: i.startMin }));
        const budget = state.cities.find((c) => c.cityId === t.cityId)?.budgetBand ?? null;
        const places = placesCache.get(t.cityId)!;
        const traveller = travellerFor(state.prefs, budget);
        const plan = planDay({
          date: t.date,
          cityId: t.cityId,
          places,
          traveller,
          travel,
          locked,
          usedPlaceIds: [...used],
          // A ticket the traveller holds lets a booking-required place in.
          bookedPlaceIds: bookedPlaceIds(bookings, places, t.date),
          move: moveOn(t.date, t.cityId),
          // A long stay shares the city's places across its days, as planTrip does.
          cityDaysLeft: targets.slice(ti).filter((x) => x.cityId === t.cityId).reduce((s, x) => s + dayShare(traveller.pace, moveOn(x.date, x.cityId)), 0),
        });
        for (const it of plan.items) used.add(it.placeId);
        tiers.push(f.tier);
        // The base is the day as saved, not as the proposed route leaves it:
        // that route drops a day in a city it no longer visits, but the
        // stale check at accept runs before the route is replaced.
        const saved = accepted.days.find((d) => d.date === t.date);
        days.push(computeDayDiff(existing?.items ?? [], plan, places, saved?.items ?? []));
      }
      if (!days.length) return failNotProposed(skipped.join("; ") || "nothing to plan");
      ctx.proposal = mergeProposals(ctx.proposal, { summary: `${days.length} day${days.length === 1 ? "" : "s"}`, days });
      return { result: j({ proposed: true, note: "Shown to the traveller as a proposal with accept and reject. Not applied yet.", days: days.map((d, i) => dayNarration(d, tiers[i])), skipped }) };
    }

    case "replan_day": {
      const p = ReplanDay.safeParse(rawInput);
      if (!p.success) return failNotProposed(`invalid input: ${p.error.issues[0].message}`);
      const r = await replanDay(store, p.data.date, p.data.ops);
      if ("error" in r) return failNotProposed(r.error);
      ctx.proposal = mergeProposals(ctx.proposal, { summary: `${p.data.date} re-planned`, days: [r.diff] });
      return { result: j({ proposed: true, note: "Shown as a proposal; not applied yet.", day: dayNarration(r.diff, r.tier) }) };
    }

    case "get_place": {

      const p = GetPlace.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const matches = await store.searchPlaces(p.data.query, p.data.city_id ?? null);
      if (!matches.length) return { result: j({ matches: [], note: "nothing in the database matches — say you don't have it rather than guessing" }) };
      return { result: j({ matches: matches.slice(0, 5).map(placeFacts) }) };
    }

    case "place_background": {
      const p = GetPlace.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const matches = await store.searchPlaces(p.data.query, p.data.city_id ?? null);
      if (!matches.length) return { result: j({ matches: [], note: "nothing in the database matches — say you don't have it rather than guessing" }) };
      // The exact place or the only match; never a guess among several.
      const q = p.data.query.trim().toLowerCase();
      const place = matches.find((m) => m.id === q || m.name.toLowerCase() === q) ?? (matches.length === 1 ? matches[0] : undefined);
      if (!place) return { result: j({ matches: matches.slice(0, 5).map((m) => ({ id: m.id, name: m.name, city_id: m.cityId })), note: "several places match — ask the traveller which one, or call again with its id" }) };
      const background = await store.background(place.id);
      if (background) return { result: j({ id: place.id, name: place.name, background: background.body, sources: background.sources, checked: true }) };
      // Counted so the most-asked places get a checked background first.
      await store.noteBackgroundAsk(place.id);
      return { result: j({ id: place.id, name: place.name, background: null, note: "no checked background yet: you may give two or three sentences of widely known background from general knowledge, and say it is general background; nothing a traveller would act on" }) };
    }

    case "route_between": {
      const p = RouteBetween.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const graph = await store.graph();
      // A walk to the station is only counted when it is on record. The
      // journey never contains a number nobody verified.
      const resolve = async (key: string): Promise<{ stationId: string; walkMin: number; walkKnown: boolean; label: string } | null> => {
        if (graph.stations.has(key)) return { stationId: key, walkMin: 0, walkKnown: true, label: graph.stations.get(key)!.name };
        const hits = await store.searchPlaces(key, null);
        const exact = hits.find((h) => h.id === key) ?? hits[0];
        if (exact?.nearestStation) return { stationId: exact.nearestStation, walkMin: exact.stationWalkMin ?? 0, walkKnown: exact.stationWalkMin != null, label: exact.name };
        const hub = hubFor(key, graph);
        if (hub) return { stationId: hub, walkMin: 0, walkKnown: true, label: graph.stations.get(hub)!.name };
        return null;
      };
      const [a, b] = await Promise.all([resolve(p.data.from), resolve(p.data.to)]);
      if (!a) return fail(`can't place "${p.data.from}" — not a station id, place id, or city id in the graph`);
      if (!b) return fail(`can't place "${p.data.to}" — not a station id, place id, or city id in the graph`);
      const r = a.walkMin || b.walkMin ? placeRoute(graph, a, b) : route(graph, a.stationId, b.stationId);
      if (!r) return { result: j({ route: null, note: `no route in the graph between ${a.label} and ${b.label} — say you can't give the journey yet` }) };
      const d = describeRoute(r);
      const notes: string[] = [];
      if (!a.walkKnown) notes.push(`the walk from ${a.label} to ${graph.stations.get(a.stationId)?.name ?? a.stationId} is not on record and is not included`);
      if (!b.walkKnown) notes.push(`the walk from ${graph.stations.get(b.stationId)?.name ?? b.stationId} to ${b.label} is not on record and is not included`);
      return { result: j({ from: a.label, to: b.label, summary: d.summary, legs: d.lines, walk_in_min: a.walkKnown ? a.walkMin || undefined : null, walk_out_min: b.walkKnown ? b.walkMin || undefined : null, notes: notes.length ? notes : undefined }) };
    }

    default:
      return fail(`unknown tool ${name}`);
  }
}
