/** BN-03: cities and nights. "Is five cities in nine days mad?" It is,
 *  and the traveller needs telling with the arithmetic shown — so the
 *  arithmetic is computed here, in code, and handed to Bento Man as data.
 *  The model narrates a verdict; it never decides one. */
import { route, type Graph } from "@/lib/transit/graph";
import { describeRoute } from "@/lib/transit/describe";
import type { CoverageTier, InterestTag } from "@/lib/types";

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

const PLANNING: Record<CoverageTier, string> = {
  deep: "can build full days here",
  outline: "can suggest places here but won't claim a day is complete",
  stub: "doesn't know this place well enough yet to plan days here",
};

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

  const legs: RouteLegAssessment[] = [];
  for (let i = 0; i + 1 < input.length; i++) {
    const a = input[i].cityId;
    const b = input[i + 1].cityId;
    const ha = facts.get(a)?.hubStation ?? hubFor(a, graph);
    const hb = facts.get(b)?.hubStation ?? hubFor(b, graph);
    const r = ha && hb ? route(graph, ha, hb) : null;
    if (r) {
      const d = describeRoute(r);
      legs.push({ fromCityId: a, toCityId: b, minutes: r.minutes, fareJpy: r.fareJpy, fareKind: r.fareKind, summary: d.summary, lines: d.lines });
    } else {
      legs.push({
        fromCityId: a, toCityId: b, minutes: null, fareJpy: null, fareKind: "estimate",
        summary: `${cities[i].name} → ${cities[i + 1].name} · no route in the graph yet`, lines: [],
      });
    }
  }

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
    reasons.push(`${staying} cities in ${totalNights} nights is ${nightsPerCity.toFixed(1)} nights per city — every second day is a moving day`);
  }
  if (movingShare > 0.3) {
    verdict = "overpacked";
    reasons.push(`${Math.round(movingShare * 100)}% of waking time spent moving`);
  }
  if (verdict === "fine" && (nightsPerCity < 2.5 && staying >= 2)) {
    verdict = "tight";
    reasons.push(`${nightsPerCity.toFixed(1)} nights per city leaves one full day in the shorter stops`);
  }
  if (verdict === "fine" && movingShare > 0.2) {
    verdict = "tight";
    reasons.push(`${Math.round(movingShare * 100)}% of waking time spent moving`);
  }
  for (const c of cities) {
    if (c.tier === "stub" && c.nights > 0) reasons.push(`${c.name} is at stub tier — Bento ${PLANNING.stub}`);
  }
  if (unknownLegs) reasons.push(`${unknownLegs} leg${unknownLegs === 1 ? "" : "s"} not in the transit graph yet, so the train time is incomplete`);

  const nightsMismatch =
    tripNights != null && tripNights !== totalNights
      ? `the trip has ${tripNights} nights and this route uses ${totalNights}`
      : null;

  const h = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m} min`);
  const arithmetic =
    staying <= 1
      ? `${staying === 1 ? cities.find((c) => c.nights > 0)!.name : "One city"}, ${totalNights} night${totalNights === 1 ? "" : "s"}, no city changes.`
      : `${staying} cities in ${totalNights} nights is ${nightsPerCity.toFixed(1)} nights per city. ` +
        `${cityChanges} city change${cityChanges === 1 ? "" : "s"} at about ${CHANGE_COST_MIN / 60} hours each (check out, station, check in) ` +
        `plus ${h(trainMinutes)} on trains is ${h(movingMinutes)} moving — about ${Math.round(movingShare * 100)}% of your waking time.`;

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
  const kyoto = (n: number) => ({ cityId: "kyoto-city", nights: n, reason: "The reason most people come. Temples, gardens, and the two mornings that make the trip." });
  const osaka = (n: number) => ({ cityId: "osaka-city", nights: n, reason: "Where the airport is, and the food. Two nights is enough; it is a base, not a sight." });
  const nara = { cityId: "nara-city", nights: 0, reason: "A day trip from Kyoto: the deer and Todai-ji, back for dinner. Bento Man can give the train." };
  const hiroshima = (n: number) => ({ cityId: "hiroshima-city", nights: n, reason: "The Peace Park in the morning, Miyajima in the afternoon. Worth the Shinkansen." });
  const himeji = { cityId: "himeji", nights: 0, reason: "On the line to Hiroshima. Get off, see the castle, get back on." };

  if (totalNights <= 2) return { cities: [kyoto(totalNights)], note: "Too short to move. One city, done properly." };
  if (totalNights === 3) return { cities: [kyoto(3), nara], note: "Kyoto with a day in Nara. Osaka is close enough for an evening if you want one." };
  if (totalNights <= 5) return { cities: [osaka(Math.min(2, totalNights - 3)), kyoto(totalNights - Math.min(2, totalNights - 3)), nara], note: "Land in Osaka, move to Kyoto. Nara as a day trip." };
  if (totalNights <= 7) {
    return {
      cities: [osaka(2), kyoto(totalNights - 4), nara, hiroshima(2)],
      note: likesHistory ? "Hiroshima earns its two nights for someone who likes history." : "Hiroshima is the one long move. Skip it and give Kyoto the nights if trains are not your thing.",
    };
  }
  const extra = totalNights - 8;
  return {
    cities: [osaka(2), kyoto(4 + extra), nara, himeji, hiroshima(2)],
    note: "The full corridor. Himeji is a stop on the way to Hiroshima, not a night.",
  };
}
