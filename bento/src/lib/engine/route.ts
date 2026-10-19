/** BN-03: cities and nights. "Is five cities in nine days mad?" It is,
 *  and the traveller needs telling with the arithmetic shown — so the
 *  arithmetic is computed here, in code, and handed to Bento Man as data.
 *  The model narrates a verdict; it never decides one. */
import { route, type Graph } from "@/lib/transit/graph";
import { describeRoute } from "@/lib/transit/describe";
import type { CoverageTier, InterestTag } from "@/lib/types";
import { copy } from "@/copy";

export interface RouteCityInput {
  cityId: string;
  nights: number;
}

export interface CityFacts {
  id: string;
  name: string;
  tier: CoverageTier;
  verifiedPlaces: number;
  transitNote: string | null;
  /** The station a trip arrives at. Null when the graph does not cover it. */
  hubStation: string | null;
}

export interface RouteLegAssessment {
  fromCityId: string;
  toCityId: string;
  /** The stay this journey ends at, so it can be shown on the day you
   *  arrive there. Null for a day trip there and back. */
  movingTo: string | null;
  /** Null when the graph has no route between the hubs. */
  minutes: number | null;
  fareJpy: number | null;
  fareKind: "exact" | "estimate";
  summary: string;
  lines: string[];
}

export type RouteVerdict = "fine" | "tight" | "overpacked";

export interface RouteAssessment {
  cities: {
    cityId: string;
    name: string;
    nights: number;
    tier: CoverageTier;
    verifiedPlaces: number;
    /** What the planner can honestly do here (§06). */
    planning: string;
  }[];
  legs: RouteLegAssessment[];
  totalNights: number;
  cityChanges: number;
  trainMinutes: number;
  /** Trains plus the hours a city change really costs. */
  movingMinutes: number;
  /** Share of waking time spent moving, 0–1. */
  movingShare: number;
  nightsPerCity: number;
  verdict: RouteVerdict;
  reasons: string[];
  /** The sentence to show the traveller. */
  arithmetic: string;
  /** The nights the trip has, when known, and whether the route uses them. */
  tripNights: number | null;
  nightsMismatch: string | null;
}

/** Where a trip lands in each city. The corridor is hand-mapped; anything
 *  else falls back to any station the graph has in that city. */
export const CITY_HUBS: Record<string, string> = {
  "kyoto-city": "kyoto",
  "osaka-city": "shin-osaka",
  "nara-city": "kintetsu-nara",
  "hiroshima-city": "hiroshima",
  himeji: "himeji",
  miyajima: "miyajima-pier",
};

/** Packing up, checking out, getting to the station, checking in at the
 *  other end. Two hours is what it costs a first-timer with luggage. */
export const CHANGE_COST_MIN = 120;
/** A long day is 10 waking hours you could have spent somewhere. */
const WAKING_MIN_PER_DAY = 600;

export function hubFor(cityId: string, graph: Graph): string | null {
  const mapped = CITY_HUBS[cityId];
  if (mapped && graph.stations.has(mapped)) return mapped;
  for (const s of graph.stations.values()) if (s.cityId === cityId) return s.id;
  return null;
}

const PLANNING: Record<CoverageTier, string> = copy.plan.route.canPlan;

export function assessRoute(
  input: RouteCityInput[],
  facts: Map<string, CityFacts>,
  graph: Graph,
  tripNights: number | null = null,
): RouteAssessment {
  const cities = input.map((c) => {
    const f = facts.get(c.cityId);
    const tier = f?.tier ?? "stub";
    return {
      cityId: c.cityId,
      name: f?.name ?? c.cityId,
      nights: c.nights,
      tier,
      verifiedPlaces: f?.verifiedPlaces ?? 0,
      planning: PLANNING[tier],
    };
  });

  const nameOf = (id: string) => cities.find((c) => c.cityId === id)?.name ?? id;
  const between = (a: string, b: string) => {
    const ha = facts.get(a)?.hubStation ?? hubFor(a, graph);
    const hb = facts.get(b)?.hubStation ?? hubFor(b, graph);
    return ha && hb ? route(graph, ha, hb) : null;
  };
  const legs: RouteLegAssessment[] = [];
  const leg = (a: string, b: string, movingTo: string | null) => {
    const r = between(a, b);
    if (r) {
      const d = describeRoute(r);
      legs.push({ fromCityId: a, toCityId: b, movingTo, minutes: r.minutes, fareJpy: r.fareJpy, fareKind: r.fareKind, summary: d.summary, lines: d.lines });
    } else {
      legs.push({
        fromCityId: a, toCityId: b, movingTo, minutes: null, fareJpy: null, fareKind: "estimate",
        summary: copy.plan.route.noLeg(nameOf(a), nameOf(b)), lines: [],
      });
    }
  };
  // A 0-night city is either a stop on the way between two stays (Himeji
  // between Kyoto and Hiroshima: get off, see the castle, get back on) or a
  // day trip from where you sleep (Nara from Kyoto: there and back). Costing
  // every city as a leg from the one before charged Kyoto → Nara → Hiroshima
  // for a trip that goes Kyoto ⇄ Nara, then Kyoto → Hiroshima.
  const onTheWay = (from: string, stop: string, to: string) => {
    const a = between(from, stop);
    const b = between(stop, to);
    const direct = between(from, to);
    return a != null && b != null && direct != null && a.minutes + b.minutes <= direct.minutes * 1.25 + 30;
  };
  let at: string | null = null; // where the traveller is when the next move starts
  let base: string | null = null; // where they last slept
  input.forEach((c, i) => {
    if (c.nights > 0) {
      if (at && at !== c.cityId) leg(at, c.cityId, c.cityId);
      at = base = c.cityId;
      return;
    }
    const next = input.slice(i + 1).find((x) => x.nights > 0)?.cityId ?? null;
    if (at && next && at !== next && onTheWay(at, c.cityId, next)) {
      leg(at, c.cityId, next);
      at = c.cityId;
      return;
    }
    const home = base ?? next;
    if (home && home !== c.cityId) {
      leg(home, c.cityId, null);
      leg(c.cityId, home, null);
    }
  });

  const totalNights = input.reduce((s, c) => s + c.nights, 0);
  const staying = input.filter((c) => c.nights > 0).length;
  const cityChanges = Math.max(0, staying - 1);
  const trainMinutes = legs.reduce((s, l) => s + (l.minutes ?? 0), 0);
  const unknownLegs = legs.filter((l) => l.minutes == null).length;
  const movingMinutes = trainMinutes + cityChanges * CHANGE_COST_MIN;
  const days = Math.max(1, totalNights + 1);
  const movingShare = movingMinutes / (days * WAKING_MIN_PER_DAY);
  const nightsPerCity = staying ? totalNights / staying : 0;

  const reasons: string[] = [];
  let verdict: RouteVerdict = "fine";
  if (staying >= 2 && nightsPerCity < 2) {
    verdict = "overpacked";
    reasons.push(copy.plan.route.tooManyCities(staying, totalNights, nightsPerCity.toFixed(1)));
  }
  if (movingShare > 0.3) {
    verdict = "overpacked";
    reasons.push(copy.plan.route.movingShare(Math.round(movingShare * 100)));
  }
  if (verdict === "fine" && (nightsPerCity < 2.5 && staying >= 2)) {
    verdict = "tight";
    reasons.push(copy.plan.route.shortStops(nightsPerCity.toFixed(1)));
  }
  if (verdict === "fine" && movingShare > 0.2) {
    verdict = "tight";
    reasons.push(copy.plan.route.movingShare(Math.round(movingShare * 100)));
  }
  for (const c of cities) {
    if (c.tier === "stub" && c.nights > 0) reasons.push(copy.plan.route.notCovered(c.name));
  }
  if (unknownLegs) reasons.push(copy.plan.route.unknownLegs(unknownLegs));

  const nightsMismatch =
    tripNights != null && tripNights !== totalNights
      ? copy.plan.route.nightsMismatch(tripNights, totalNights)
      : null;

  const h = copy.plan.route.hours;
  const arithmetic =
    staying <= 1
      ? copy.plan.route.oneCity(staying === 1 ? cities.find((c) => c.nights > 0)!.name : copy.plan.route.oneCityUnnamed, totalNights)
      : copy.plan.route.arithmetic(staying, totalNights, nightsPerCity.toFixed(1), cityChanges, CHANGE_COST_MIN / 60, h(trainMinutes), h(movingMinutes), Math.round(movingShare * 100));

  return { cities, legs, totalNights, cityChanges, trainMinutes, movingMinutes, movingShare, nightsPerCity, verdict, reasons, arithmetic, tripNights, nightsMismatch };
}

export interface CityDates {
  cityId: string;
  nights: number;
  arriveDate: string | null;
  departDate: string | null;
  /** The dates whose days are planned in this city. */
  dates: string[];
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Lays the route out on the calendar. The departure day belongs to the
 *  next city — you wake up, pack, and the day is spent where you arrive.
 *  A zero-night city (a day trip, an en-route stop) takes no dates of its
 *  own; its day is planned by overriding a date's city. */
export function allocateDates(startDate: string | null, cities: RouteCityInput[], endDate: string | null = null): CityDates[] {
  if (!startDate) return cities.map((c) => ({ cityId: c.cityId, nights: c.nights, arriveDate: null, departDate: null, dates: [] }));
  const out: CityDates[] = [];
  let cursor = startDate;
  const staying = cities.filter((c) => c.nights > 0);
  const last = staying[staying.length - 1];
  for (const c of cities) {
    if (c.nights === 0) {
      out.push({ cityId: c.cityId, nights: 0, arriveDate: null, departDate: null, dates: [] });
      continue;
    }
    const arrive = cursor;
    const depart = addDays(cursor, c.nights);
    const dates: string[] = [];
    for (let i = 0; i < c.nights; i++) dates.push(addDays(arrive, i));
    // The last city keeps its departure day if the trip's end date allows a
    // final day there (an evening flight, say).
    if (c === last && endDate && endDate >= depart) dates.push(depart);
    out.push({ cityId: c.cityId, nights: c.nights, arriveDate: arrive, departDate: depart, dates });
    cursor = depart;
  }
  return out;
}

/** A starting route for the corridor by trip length. A table, not a
 *  search: there is one good answer per length and it should be the same
 *  answer every time. Bento Man explains it; assess_route checks it. */
export function suggestRoute(totalNights: number, interests: InterestTag[] = []): { cities: (RouteCityInput & { reason: string })[]; note: string } {
  const likesHistory = interests.includes("history") || interests.includes("shrines");
  const kyoto = (n: number) => ({ cityId: "kyoto-city", nights: n, reason: copy.plan.route.suggestions.kyoto });
  const osaka = (n: number) => ({ cityId: "osaka-city", nights: n, reason: copy.plan.route.suggestions.osaka });
  const nara = { cityId: "nara-city", nights: 0, reason: copy.plan.route.suggestions.nara };
  const hiroshima = (n: number) => ({ cityId: "hiroshima-city", nights: n, reason: copy.plan.route.suggestions.hiroshima });
  const himeji = { cityId: "himeji", nights: 0, reason: copy.plan.route.suggestions.himeji };

  if (totalNights <= 2) return { cities: [kyoto(totalNights)], note: copy.plan.route.suggestions.tooShort };
  if (totalNights === 3) return { cities: [kyoto(3), nara], note: copy.plan.route.suggestions.kyotoNara };
  if (totalNights <= 5) return { cities: [osaka(Math.min(2, totalNights - 3)), kyoto(totalNights - Math.min(2, totalNights - 3)), nara], note: copy.plan.route.suggestions.osakaKyoto };
  if (totalNights <= 7) {
    return {
      cities: [osaka(2), kyoto(totalNights - 4), nara, hiroshima(2)],
      note: likesHistory ? copy.plan.route.suggestions.hiroshimaHistory : copy.plan.route.suggestions.hiroshimaOptional,
    };
  }
  const extra = totalNights - 8;
  return {
    cities: [osaka(2), kyoto(4 + extra), nara, himeji, hiroshima(2)],
    note: copy.plan.route.suggestions.full,
  };
}
