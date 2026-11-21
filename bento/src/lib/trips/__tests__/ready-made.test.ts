import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { assessRoute, hubFor, type CityFacts } from "@/lib/engine/route";
import { planTrip } from "@/lib/engine/trip";
import { travelFromGraph } from "@/lib/engine/travel";
import { cityTrainMinutes } from "@/lib/engine/travel-day";
import { parseClock, parseWindow } from "@/lib/engine/filter";
import { closedYearlyOn } from "@/lib/engine/closures";
import { closedMustSees } from "../ready-made/closed";
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
const trainMinutes = cityTrainMinutes(graph, facts);

// Each day of the week (Monday 10 to Sunday 16 May 2027), then one start
// in each season, then two over the year-end break (30 Dec and 1 Jan), when
// many museums, castles and gardens close (`closedYearly`). The trips run on
// from there, so every day of a long trip meets several weekdays too. What a
// season changes is the scoring (season tags) only: a place has one set of
// hours all year (the shortest, when they vary), and public holidays aren't
// in the data, so neither is tested here.
const WEEK = ["2027-05-10", "2027-05-11", "2027-05-12", "2027-05-13", "2027-05-14", "2027-05-15", "2027-05-16"];
const SEASONS = { winter: "2027-01-20", spring: "2027-04-01", summer: "2027-07-17", autumn: "2026-11-24" };
const YEAR_END = ["2026-12-30", "2027-01-01"];
const STARTS = [...WEEK, ...Object.values(SEASONS), ...YEAR_END];

// Every start from 11 Dec to 5 Jan. The yearly closures in the seeds run
// from 25 Dec at the earliest to 4 Jan at the latest, so this covers every
// start whose days can meet one, the 14-day trip included. Checked for
// refusal, and each start that isn't refused planned at one pace and crowd
// setting.
const addDay = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const WINDOW = Array.from({ length: 26 }, (_, i) => addDay("2026-12-11", i));

// A start that would put a must-see on a day it is closed is refused before
// anything is planned (`closedMustSees`: the picker, and suggest_route for a
// trip with dates; the owner's call, 21 Nov 2026). Over the year-end window
// these are every refused start, with the must-sees that refuse it: Osaka
// Castle (28 Dec – 1 Jan), the Peace Memorial Museum (30–31 Dec) and
// Shukkeien Garden (29–31 Dec). Every other start must plan with every
// must-see open.
const REFUSED: Record<string, Record<string, string[]>> = {
  "osaka-day": Object.fromEntries(["2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01"].map((d) => [d, ["Osaka Castle"]])),
  "osaka-kyoto-nara-5": Object.fromEntries(["2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31"].map((d) => [d, ["Osaka Castle"]])),
  "classic-7": Object.fromEntries(["2026-12-23", "2026-12-24", "2026-12-25", "2026-12-26", "2026-12-27"].map((d) => [d, ["Osaka Castle"]])),
  "kansai-hiroshima-7": {
    "2026-12-23": ["Shukkeien Garden"],
    "2026-12-24": ["Shukkeien Garden"],
    "2026-12-25": ["Peace Memorial Museum", "Shukkeien Garden"],
    "2026-12-26": ["Peace Memorial Museum"],
  },
  "tokyo-to-miyajima-10": {
    "2026-12-20": ["Shukkeien Garden"],
    "2026-12-21": ["Shukkeien Garden"],
    "2026-12-22": ["Osaka Castle", "Shukkeien Garden"],
    "2026-12-23": ["Osaka Castle", "Peace Memorial Museum"],
    "2026-12-24": ["Osaka Castle", "Peace Memorial Museum"],
    "2026-12-25": ["Osaka Castle"],
    "2026-12-26": ["Osaka Castle"],
  },
  "all-nine-14": {
    "2026-12-16": ["Shukkeien Garden"],
    "2026-12-17": ["Shukkeien Garden"],
    "2026-12-18": ["Shukkeien Garden"],
    "2026-12-19": ["Osaka Castle", "Peace Memorial Museum"],
    "2026-12-20": ["Osaka Castle", "Peace Memorial Museum"],
    "2026-12-21": ["Osaka Castle"],
    "2026-12-22": ["Osaka Castle"],
    "2026-12-23": ["Osaka Castle"],
  },
};
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

      it("is refused on exactly the starts that put a must-see on a closed day", () => {
        const found: Record<string, string[]> = {};
        for (const start of [...new Set([...STARTS, ...WINDOW])]) {
          const closed = closedMustSees(trip, start, placeById);
          if (closed.length) found[start] = closed.map((c) => c.name);
        }
        expect(found).toEqual(REFUSED[trip.id] ?? {});
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
        for (const start of [...new Set([...STARTS, ...WINDOW])]) {
          // Refused before planning: no traveller gets this start.
          if (closedMustSees(trip, start, placeById).length) continue;
          // The year-end window at one setting; the rest at every one.
          const everySetting = STARTS.includes(start);
          for (const pace of everySetting ? PACES : ["standard" as const])
            for (const crowdTolerance of everySetting ? CROWDS : [0.6]) {
              const input = readyMadeToPlan(trip, start);
              const plan = planTrip({
                days: input.days,
                traveller: { pace, interestTags: [], energy: 0.5, crowdTolerance, discovery: 0.5, excludes: [], mobility: [] },
                budgetByCity: {},
                placesByCity,
                travel,
                trainMinutes,
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
                  const yearly = closedYearlyOn(seed, day.date);
                  if (yearly) bad.push(`${at}: ${id} is closed that date every year`);
                  if (seed.booking === "required") bad.push(`${at}: ${id} needs a ticket`);
                  const closes = parseClock(seed.closes);
                  if (closes != null && item.endMin > closes) bad.push(`${at}: ${id} runs past closing`);
                }
                // The right time of day (time-of-day.test.ts): an evening
                // place ("after 17:30") never by day, and "unavoidable" only on
                // a travel day that starts after every quiet window.
                for (const x of day.items) {
                  const wins = (placeById.get(x.placeId)!.window ?? []).map(parseWindow);
                  const eve = wins.length && wins.every((w) => w.after != null && w.after >= 17 * 60);
                  if (eve && x.startMin < Math.min(...wins.map((w) => w.after!))) bad.push(`${at}: ${x.placeId} by day`);
                  if (x.reason.includes(copy.plan.reasons.busiestHour)) {
                    const reachable = wins.some((w) => (w.before != null && day.startMin <= w.before) || w.after != null);
                    if (input.days[i].movingFrom == null || reachable) bad.push(`${at}: ${x.placeId} called unavoidable`);
                  }
                }
                // The whole day, pins included, holds no conflicting pair.
                for (const x of day.items)
                  for (const y of day.items)
                    if ((placeById.get(x.placeId)!.conflicts ?? []).includes(y.placeId)) bad.push(`${at}: ${x.placeId} with ${y.placeId}`);
                for (const w of day.warnings) if (/pinned/i.test(w)) bad.push(`${at}: ${w}`);
                // Every warning speaks only of this day's stops: one naming a
                // place of the city names one the day holds. (A name inside
                // the name of a stop the day holds doesn't count.)
                const inDay = day.items.map((x) => x.name);
                for (const w of day.warnings)
                  for (const p of placesByCity[day.cityId] ?? []) {
                    if (inDay.includes(p.name) || !w.includes(p.name)) continue;
                    if (inDay.some((n) => n.includes(p.name) && w.includes(n))) continue;
                    bad.push(`${at}: "${w}" names ${p.name}, not in the day`);
                  }
                // A full day has at least one stop the planner chose, and no
                // chosen stop had to make way for a must-see. A relaxed travel
                // day may hold only its must-sees: the move takes the time a
                // stop of the planner's own would have had (engine.md).
                const relaxedMove = pace === "relaxed" && input.days[i].movingFrom != null;
                const full = (trip.days === 1 || (i > 0 && i < trip.days - 1)) && !relaxedMove;
                if (full && !day.items.some((x) => !x.locked)) bad.push(`${at}: nothing chosen around the must-sees`);
                const madeWay = new Set(must.map((id) => copy.plan.leftOut.makesPinLate(placeById.get(id)!.name)));
                for (const r of day.considered) if (r.stage === "validate" && madeWay.has(r.detail)) bad.push(`${at}: ${r.placeId} ${r.detail}`);
              });
            }
        }
        expect(bad).toEqual([]);
        // Every start, pace and crowd setting: Tokyo's trips plan over the
        // whole Kanto network, which takes a few seconds on a busy runner.
      }, 30_000);
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

  it("marks each travel day with the stay the traveller moves from, and no other day", () => {
    const five = readyMadeToPlan(readyMadeTrips.find((t) => t.id === "osaka-kyoto-nara-5")!, "2026-11-24");
    expect(five.days.map((d) => d.movingFrom)).toEqual([undefined, undefined, "osaka-city", undefined, undefined]);
    expect(readyMadeToPlan(trip, "2026-11-24").days.every((d) => d.movingFrom === undefined)).toBe(true);
    // Himeji on the way to Hiroshima: the day there starts after the ride from Kyoto.
    const seven = readyMadeToPlan(readyMadeTrips.find((t) => t.id === "kansai-hiroshima-7")!, "2026-11-24");
    expect(seven.days.map((d) => [d.cityId, d.movingFrom])).toEqual([
      ["osaka-city", undefined],
      ["nara-city", undefined],
      ["kyoto-city", "osaka-city"],
      ["kyoto-city", undefined],
      ["himeji", "kyoto-city"],
      ["hiroshima-city", undefined],
      ["hiroshima-city", undefined],
    ]);
  });

  it("refuses a start that is not a real date", () => {
    expect(() => readyMadeToPlan(trip, "2026-02-30")).toThrow();
    expect(() => readyMadeToPlan(trip, "next week")).toThrow();
  });
});
