/** What a fuller day must not do to fill its time (review of the change
 *  that grows days until their time is spent, Nov 2026): strip a day whose
 *  pins cross town, wait hours for a place to open, or run a daytime stop
 *  into the night. Swept over every ready-made trip at each pace. */
import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { DAY_BUDGET_MINUTES, type TravelPace } from "@/lib/types";
import { copy } from "@/copy";
import { readyMadeTrips } from "@/lib/trips/ready-made";
import { READY_MADE_CITIES } from "@/lib/trips/ready-made/types";
import { readyMadeToPlan } from "@/lib/trips/ready-made/to-plan";
import { hubFor, type CityFacts } from "../route";
import { eveningFrom, eveningWindow, planDay } from "../schedule";
import { planTrip, type TripPlan } from "../trip";
import { travelFromGraph } from "../travel";
import { cityTrainMinutes } from "../travel-day";
import type { PlaceInput } from "../types";

const graph = buildGraph(stations, edges);
const travel = travelFromGraph(graph);
const placesByCity: Record<string, PlaceInput[]> = {};
for (const p of placeSeeds.flatMap((s) => s.places)) (placesByCity[p.city] ??= []).push(seedToPlaceInput(p));
const byId = new Map(Object.values(placesByCity).flat().map((p) => [p.id, p]));
const facts = new Map<string, CityFacts>(
  READY_MADE_CITIES.map((id) => [id, { id, name: id, tier: "deep", verifiedPlaces: 0, transitNote: null, hubStation: hubFor(id, graph) }]),
);
const trainMinutes = cityTrainMinutes(graph, facts);
const traveller = (pace: TravelPace, crowdTolerance = 0.6) =>
  ({ pace, interestTags: [], energy: 0.5, crowdTolerance, discovery: 0.5, excludes: [], mobility: [] });
const PACES: TravelPace[] = ["relaxed", "standard", "packed"];

const sweep = (): { at: string; pace: TravelPace; crowd: number; plan: TripPlan }[] => {
  const out: { at: string; pace: TravelPace; crowd: number; plan: TripPlan }[] = [];
  for (const trip of readyMadeTrips)
    for (const pace of PACES)
      for (const crowd of [0.2, 0.6]) {
        const days = readyMadeToPlan(trip, "2027-05-12").days;
        out.push({ at: `${trip.id} ${pace} ${crowd}`, pace, crowd, plan: planTrip({ days, traveller: traveller(pace, crowd), budgetByCity: {}, placesByCity, travel, trainMinutes }) });
      }
  return out;
};

describe("a fuller day", () => {
  it("keeps its stops when its pins cross town", () => {
    // Kodai-ji, Kinkaku-ji and Yasaka Shrine pinned at 09:00, 12:00 and
    // 16:00: east, west, east. The day has to cross town twice; dropping
    // the stops between for "coming back" stripped a packed day to its pins
    // and said some places couldn't be fitted to their hours.
    const locked = [
      { placeId: "kyt-kodaiji", startMin: 9 * 60 },
      { placeId: "kyt-kinkakuji", startMin: 12 * 60 },
      { placeId: "kyt-yasaka-shrine", startMin: 16 * 60 },
    ];
    for (const pace of ["standard", "packed"] as const) {
      const plan = planDay({ date: "2027-05-12", cityId: "kyoto-city", places: placesByCity["kyoto-city"], traveller: { ...traveller(pace), budgetBand: null }, travel, locked });
      const at = `${pace}: ${plan.items.map((i) => i.placeId).join(" > ")}`;
      expect(plan.items.length, at).toBeGreaterThanOrEqual(pace === "packed" ? 7 : 5);
      expect(plan.warnings, at).not.toContain(copy.plan.warnings.hoursNotFitted);
      expect(plan.considered.filter((r) => r.detail.startsWith(copy.plan.leftOut.comesBack("").slice(0, 20))), at).toEqual([]);
    }
  });

  it("never keeps the day waiting over two hours for a stop it chose, nor runs a daytime stop it chose past the day's end", () => {
    const bad: string[] = [];
    for (const { at, pace, plan } of sweep())
      for (const day of plan.days) {
        // A 09:00 start, the pace's time and an hour for lunch, and never
        // after 19:00: relaxed 16:00, standard 18:00, packed 19:00. An early
        // riser starts early to beat the crowds, not to finish early, and a
        // travel day starts later by the move but has that much less time.
        const usual = Math.min(19 * 60, 9 * 60 + DAY_BUDGET_MINUTES[pace] + 60);
        day.items.forEach((it, k) => {
          if (it.locked || k === 0) return;
          const prev = day.items[k - 1];
          const p = byId.get(it.placeId)!;
          const evening = eveningFrom(p) ?? eveningWindow(p);
          const reached = prev.endMin + (it.arriveBy?.minutes ?? 0);
          const lunch = day.meals.find((m) => m.startMin >= prev.endMin && m.endMin <= it.startMin);
          const wait = it.startMin - reached - (lunch ? lunch.endMin - lunch.startMin : 0);
          if (evening == null && wait > 120) bad.push(`${at} ${day.date}: waits ${wait} min for ${it.placeId}`);
          if (evening == null && it.endMin > usual) bad.push(`${at} ${day.date}: ${it.placeId} ends ${it.endMin}, after ${usual}`);
        });
      }
    expect(bad).toEqual([]);
  }, 120_000);

  it("plans a day in well under a tenth of a second", () => {
    // Every ready-made trip at each pace and both start times: about 400
    // days. Measured at about 8 ms a day before days grew to their budget;
    // the bound is generous for a busy runner, and catches a planner that
    // starts trying every order of every stop.
    const t0 = performance.now();
    const plans = sweep();
    const days = plans.reduce((s, x) => s + x.plan.days.length, 0);
    expect((performance.now() - t0) / days).toBeLessThan(60);
  }, 120_000);
});
