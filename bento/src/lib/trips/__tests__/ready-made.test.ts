import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { assessRoute, hubFor, type CityFacts } from "@/lib/engine/route";
import { planTrip } from "@/lib/engine/trip";
import { travelFromGraph } from "@/lib/engine/travel";
import { parseClock } from "@/lib/engine/filter";
import type { PlaceInput } from "@/lib/engine/types";
import type { TravelPace } from "@/lib/types";
import { copy } from "@/copy";
import { readyMadeTrips } from "../ready-made";
import { READY_MADE_CITIES } from "../ready-made/types";
import { readyMadeToPlan } from "../ready-made/to-plan";

/** Every ready-made trip, checked against the seeds as the live database
 *  will hold them once the owner has signed them off (every place treated
 *  as verified, every city as planned). The live tiers are a publishing
 *  step, not something a test can see: READY_MADE_CITIES says so. */
const graph = buildGraph(stations, edges);
const travel = travelFromGraph(graph);
const allPlaces = placeSeeds.flatMap((s) => s.places);
const placeById = new Map(allPlaces.map((p) => [p.id, p]));
const placesByCity: Record<string, PlaceInput[]> = {};
for (const p of allPlaces) (placesByCity[p.city] ??= []).push(seedToPlaceInput(p));
const facts = new Map<string, CityFacts>(
  READY_MADE_CITIES.map((id) => [id, { id, name: id, tier: "deep", verifiedPlaces: placesByCity[id]?.length ?? 0, transitNote: null, hubStation: hubFor(id, graph) }]),
);

// Each day of the week (Monday 10 to Sunday 16 May 2027), then one start
// in each season. The trips run on from there, so every day of a long trip
// meets several weekdays too. What a season changes is the scoring (season
// tags) only: a place has one set of hours all year (the shortest, when they
// vary), and public holidays and year-end closures aren't in the data, so
// none of those is tested here.
const WEEK = ["2027-05-10", "2027-05-11", "2027-05-12", "2027-05-13", "2027-05-14", "2027-05-15", "2027-05-16"];
const SEASONS = { winter: "2027-01-20", spring: "2027-04-01", summer: "2027-07-17", autumn: "2026-11-24" };
const STARTS = [...WEEK, ...Object.values(SEASONS)];
const PACES: TravelPace[] = ["relaxed", "standard", "packed"];
const CROWDS = [0.2, 0.6]; // an early riser (07:00) and a 09:00 start

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("ready-made trips", () => {
  it("has the proposed list: one trip per agreed idea, unique ids", () => {
    const ids = readyMadeTrips.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    const byLength = (n: number) => readyMadeTrips.filter((t) => t.days === n).length;
    expect([1, 2, 3, 5, 7, 10, 14].map(byLength)).toEqual([8, 2, 2, 2, 2, 1, 1]);
  });

  it("has a title, a summary and a reason for every city, with no times, fares or durations", () => {
    expect(Object.keys(copy.readyMade.trips).sort()).toEqual(readyMadeTrips.map((t) => t.id).sort());
    for (const t of readyMadeTrips) {
      const text = copy.readyMade.trips[t.id];
      const reasons: Record<string, string> = text.reasons;
      expect(Object.keys(reasons).sort(), t.id).toEqual([...new Set(t.route.map((c) => c.cityId))].sort());
      for (const line of [text.title, text.summary, ...Object.values(reasons)]) {
        expect(line.trim(), t.id).not.toBe("");
        // A number in the words would be a time, a fare, a duration or a count
        // the engine owns.
        expect(line, t.id).not.toMatch(/\d|¥|\byen\b|\bminutes?\b|\bhours?\b|\bmins?\b/i);
      }
    }
  });

  for (const trip of readyMadeTrips) {
    describe(trip.id, () => {
      it("uses only known cities in the allowed set and places that exist in that day's city", () => {
        for (const c of trip.route) expect(READY_MADE_CITIES as readonly string[], c.cityId).toContain(c.cityId);
        const plan = readyMadeToPlan(trip, WEEK[0]);
        trip.mustSee.forEach((ids, i) => {
          for (const id of ids) {
            expect(placeById.has(id), `day ${i + 1}: ${id}`).toBe(true);
            expect(placeById.get(id)!.city, `day ${i + 1}: ${id}`).toBe(plan.days[i].cityId);
          }
        });
      });

      it("has its nights add up to its length, one list per day, at most three each, no place twice", () => {
        expect(sum(trip.route.map((c) => c.nights))).toBe(trip.days - 1);
        expect(trip.mustSee).toHaveLength(trip.days);
        for (const ids of trip.mustSee) {
          expect(ids.length).toBeGreaterThanOrEqual(1);
          expect(ids.length).toBeLessThanOrEqual(3);
        }
        const all = trip.mustSee.flat();
        expect(new Set(all).size).toBe(all.length);
      });

      if (trip.days > 1) {
        it("keeps the arrival and departure days light: one must-see at most", () => {
          expect(trip.mustSee[0].length, "day 1").toBeLessThanOrEqual(1);
          expect(trip.mustSee[trip.days - 1].length, `day ${trip.days}`).toBeLessThanOrEqual(1);
        });
      }

      it("gives every zero-night city one day, and every stay at least one of its own", () => {
        const zero = trip.route.filter((c) => c.nights === 0).map((c) => c.cityId).sort();
        expect(trip.dayTrips.map((d) => d.cityId).sort()).toEqual(zero);
        const dayNumbers = trip.dayTrips.map((d) => d.day);
        expect(new Set(dayNumbers).size).toBe(dayNumbers.length);
        for (const n of dayNumbers) expect(n >= 1 && n <= trip.days, `day ${n}`).toBe(true);
        const plan = readyMadeToPlan(trip, WEEK[0]);
        expect(plan.days).toHaveLength(trip.days);
        expect(plan.endDate).toBe(plan.days[plan.days.length - 1].date);
        for (const c of trip.route.filter((x) => x.nights > 0)) expect(plan.days.some((d) => d.cityId === c.cityId), c.cityId).toBe(true);
      });

      it("is not overpacked and has a known train between every pair of cities", () => {
        const a = assessRoute(trip.route, facts, graph, trip.days - 1);
        expect(a.verdict, a.arithmetic).not.toBe("overpacked");
        expect(a.nightsMismatch).toBeNull();
        expect(a.legs.filter((l) => l.minutes == null).map((l) => `${l.fromCityId} → ${l.toCityId}`)).toEqual([]);
      });

      it("never puts two must-see places that conflict on one day (pins skip the planner's check)", () => {
        trip.mustSee.forEach((ids, i) => {
          for (const a of ids)
            for (const b of ids) {
              if (a === b) continue;
              expect(placeById.get(a)!.conflicts ?? [], `day ${i + 1}: ${a} / ${b}`).not.toContain(b);
            }
        });
      });

      it("plans every day and keeps every must-see, open and in its hours, for a start on each weekday and with each season's scoring", () => {
        const bad: string[] = [];
        for (const start of STARTS)
          for (const pace of PACES)
            for (const crowdTolerance of CROWDS) {
              const input = readyMadeToPlan(trip, start);
              const plan = planTrip({
                days: input.days,
                traveller: { pace, interestTags: [], energy: 0.5, crowdTolerance, discovery: 0.5, excludes: [], mobility: [] },
                budgetByCity: {},
                placesByCity,
                travel,
              });
              plan.days.forEach((day, i) => {
                const at = `${start} ${pace} crowd ${crowdTolerance} day ${i + 1} (${day.date})`;
                const must = trip.mustSee[i];
                if (day.items.length < Math.max(2, must.length)) bad.push(`${at}: only ${day.items.length} stops`);
                const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
                for (const id of must) {
                  const item = day.items.find((x) => x.placeId === id);
                  const seed = placeById.get(id)!;
                  if (!item) { bad.push(`${at}: ${id} missing`); continue; }
                  if (seed.closedWeekdays?.includes(weekday)) bad.push(`${at}: ${id} is closed that day`);
                  if (seed.booking === "required") bad.push(`${at}: ${id} needs a ticket`);
                  const closes = parseClock(seed.closes);
                  if (closes != null && item.endMin > closes) bad.push(`${at}: ${id} runs past closing`);
                }
                // The whole day, pins included, holds no conflicting pair.
                for (const x of day.items)
                  for (const y of day.items)
                    if ((placeById.get(x.placeId)!.conflicts ?? []).includes(y.placeId)) bad.push(`${at}: ${x.placeId} with ${y.placeId}`);
                for (const w of day.warnings) if (/pinned/i.test(w)) bad.push(`${at}: ${w}`);
                // A full day has at least one stop the planner chose, and no
                // chosen stop had to make way for a must-see.
                const full = trip.days === 1 || (i > 0 && i < trip.days - 1);
                if (full && !day.items.some((x) => !x.locked)) bad.push(`${at}: nothing chosen around the must-sees`);
                const madeWay = new Set(must.map((id) => copy.plan.leftOut.makesPinLate(placeById.get(id)!.name)));
                for (const r of day.considered) if (r.stage === "validate" && madeWay.has(r.detail)) bad.push(`${at}: ${r.placeId} ${r.detail}`);
              });
            }
        expect(bad).toEqual([]);
      });
    });
  }
});

describe("readyMadeToPlan", () => {
  const trip = readyMadeTrips.find((t) => t.id === "kyoto-nara-3")!;

  it("lays the route on the calendar with the day trip moved to its city and the must-sees pinned", () => {
    const p = readyMadeToPlan(trip, "2026-11-24");
    expect(p.endDate).toBe("2026-11-26");
    expect(p.route.map((c) => [c.cityId, c.nights])).toEqual([["kyoto-city", 2], ["nara-city", 0]]);
    expect(p.route.every((c) => c.reason.length > 0)).toBe(true);
    expect(p.days.map((d) => [d.date, d.cityId])).toEqual([
      ["2026-11-24", "kyoto-city"],
      ["2026-11-25", "nara-city"],
      ["2026-11-26", "kyoto-city"],
    ]);
    expect(p.dayTrips).toEqual([{ date: "2026-11-25", cityId: "nara-city" }]);
    expect(p.days[1].locked).toEqual(trip.mustSee[1].map((placeId) => ({ placeId })));
  });

  it("refuses a start that is not a real date", () => {
    expect(() => readyMadeToPlan(trip, "2026-02-30")).toThrow();
    expect(() => readyMadeToPlan(trip, "next week")).toThrow();
  });
});
