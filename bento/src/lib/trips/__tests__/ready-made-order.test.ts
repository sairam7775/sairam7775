import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { hubFor, type CityFacts } from "@/lib/engine/route";
import { planTrip, type TripPlan } from "@/lib/engine/trip";
import { travelFromGraph } from "@/lib/engine/travel";
import { cityTrainMinutes } from "@/lib/engine/travel-day";
import type { DayPlan, PlaceInput } from "@/lib/engine/types";
import type { TravelPace } from "@/lib/types";
import { readyMadeTrips } from "../ready-made";
import { READY_MADE_CITIES } from "../ready-made/types";
import { readyMadeToPlan } from "../ready-made/to-plan";

/** Days that go back and forth across town, found reading the ready-made
 *  trips on 20 Nov: each case is one, at the pace and start it was seen
 *  with, then a sweep over every trip. Distances are straight lines between
 *  the seeds' coordinates, so they test the geography, not the engine's
 *  own minutes. */
const graph = buildGraph(stations, edges);
const travel = travelFromGraph(graph);
const seeds = placeSeeds.flatMap((s) => s.places);
const seedById = new Map(seeds.map((p) => [p.id, p]));
const placesByCity: Record<string, PlaceInput[]> = {};
for (const p of seeds) (placesByCity[p.city] ??= []).push(seedToPlaceInput(p));
const facts = new Map<string, CityFacts>(
  READY_MADE_CITIES.map((id) => [id, { id, name: id, tier: "deep", verifiedPlaces: 0, transitNote: null, hubStation: hubFor(id, graph) }]),
);
const trainMinutes = cityTrainMinutes(graph, facts);

const plan = (tripId: string, start = "2027-05-12", pace: TravelPace = "standard", crowdTolerance = 0.6): TripPlan => {
  const trip = readyMadeTrips.find((t) => t.id === tripId)!;
  return planTrip({
    days: readyMadeToPlan(trip, start).days,
    traveller: { pace, interestTags: [], energy: 0.5, crowdTolerance, discovery: 0.5, excludes: [], mobility: [] },
    budgetByCity: {},
    placesByCity,
    travel,
    trainMinutes,
  });
};

/** Kilometres in a straight line between two seed places. */
const km = (a: string, b: string) => {
  const p = seedById.get(a)!;
  const q = seedById.get(b)!;
  const rad = Math.PI / 180;
  const x = (q.lon - p.lon) * rad * Math.cos(((p.lat + q.lat) / 2) * rad);
  const y = (q.lat - p.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371;
};

/** Every time the day leaves a stop's area and comes back to it: a later
 *  stop within 600 m of an earlier one, reached by a detour of more than
 *  `detourKm` (a kilometre and a half unless said) through stops between. */
const returns = (day: DayPlan, detourKm = 1.5): string[] => {
  const ids = day.items.map((i) => i.placeId);
  const out: string[] = [];
  for (let i = 0; i < ids.length; i++)
    for (let k = i + 2; k < ids.length; k++) {
      const direct = km(ids[i], ids[k]);
      if (direct > 0.6) continue;
      let path = 0;
      for (let j = i; j < k; j++) path += km(ids[j], ids[j + 1]);
      if (path - direct > detourKm) out.push(`${day.date}: ${ids.slice(i, k + 1).join(" > ")}`);
    }
  return out;
};

const names = (day: DayPlan) => day.items.map((i) => i.placeId);
const travelMin = (day: DayPlan) => day.items.reduce((s, i) => s + (i.arriveBy?.minutes ?? 0), 0);

describe("ready-made days don't go back and forth", () => {
  it("Osaka in a day: the castle's neighbours are seen together, not split by a trip to Umeda", () => {
    const day = plan("osaka-day").days[0];
    expect(returns(day), names(day).join(" > ")).toEqual([]);
    const ids = names(day);
    const castle = ids.indexOf("osk-osaka-castle");
    const museum = ids.indexOf("osk-museum-of-history");
    // Before: museum > Umeda Sky > castle park > castle, 78 min of travel.
    if (museum >= 0) for (const id of ids.slice(Math.min(museum, castle) + 1, Math.max(museum, castle))) expect(km(id, "osk-osaka-castle"), id).toBeLessThan(1.5);
    expect(travelMin(day)).toBeLessThan(78);
  });

  it("Osaka, Kyoto and Nara day 2 is the same day as Osaka in a day", () => {
    const day = plan("osaka-kyoto-nara-5").days[1];
    expect(returns(day), names(day).join(" > ")).toEqual([]);
    expect(travelMin(day)).toBeLessThan(78);
  });

  it("Osaka, Kyoto and Nara day 1: Hozenji Yokocho beside Dotonbori, not after Kuromon and Den Den Town", () => {
    const day = plan("osaka-kyoto-nara-5").days[0];
    expect(returns(day), names(day).join(" > ")).toEqual([]);
  });

  it("Kyoto's east side: Gion and Yasaka come before the walk west to Pontocho and the river", () => {
    for (const [tripId, i] of [["kyoto-east", 0], ["osaka-kyoto-nara-5", 2]] as const) {
      const day = plan(tripId).days[i];
      const ids = names(day);
      expect(returns(day), ids.join(" > ")).toEqual([]);
      // Between Kiyomizu-dera and Gion nothing west of the river's east bank.
      const from = ids.indexOf("kyt-kiyomizu");
      const to = ids.indexOf("kyt-gion");
      for (const id of ids.slice(from + 1, to)) expect(seedById.get(id)!.lon, `${tripId}: ${ids.join(" > ")}`).toBeGreaterThan(135.772);
      expect(travelMin(day)).toBeLessThan(48);
    }
  });

  it("Arashiyama: along the river to the bamboo path and up to Okochi Sanso, not down and back up", () => {
    for (const [tripId, i] of [["osaka-kyoto-nara-5", 4], ["kyoto-2", 1], ["kyoto-arashiyama", 0]] as const) {
      const day = plan(tripId).days[i];
      expect(returns(day), `${tripId}: ${names(day).join(" > ")}`).toEqual([]);
    }
  });

  it("the one-day Arashiyama trip starts in Arashiyama, not in central Kyoto", () => {
    const day = plan("kyoto-arashiyama").days[0];
    // Before: Kamo River banks first, then 41 min to the bamboo grove.
    expect(km(day.items[0].placeId, "kyt-arashiyama-bamboo"), names(day).join(" > ")).toBeLessThan(1.5);
  });

  // Over every trip, pace and start the bar is a detour of 3.5 km: in a
  // walking district (Nara Park and Naramachi, Yokohama's bay, Shibuya at
  // sunset) the shortest walk can loop back by up to about 3.4 km, which is
  // a loop, not a trip across town. Before the fix the worst was 10 km
  // (Maruyama Park, south to Fushimi Inari, back to Shoren-in) and a dozen
  // day shapes passed 3.5 km.
  it("no ready-made day crosses town and comes back, at any pace or start time", () => {
    const bad: string[] = [];
    for (const trip of readyMadeTrips)
      for (const pace of ["relaxed", "standard", "packed"] as const)
        for (const crowd of [0.2, 0.6])
          for (const start of ["2027-05-10", "2027-05-12", "2026-11-24"])
            for (const day of plan(trip.id, start, pace, crowd).days) for (const r of returns(day, 3.5)) bad.push(`${trip.id} ${pace} ${crowd} ${r}`);
    expect(bad).toEqual([]);
  }, 60_000);
});
