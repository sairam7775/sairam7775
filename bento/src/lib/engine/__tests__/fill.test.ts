/** A day fills its pace's time. Live read-through of the ready-made trips
 *  (Nov 2026): most standard days ended between 14:26 and 14:48 with about
 *  4h30m active of 8h, because growing stopped at a fixed count of stops
 *  per pace (relaxed 4, standard 5, packed 7), not when the time ran out.
 *  Packed days, with their shorter visits, were the thinnest of all. */
import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { kyoto as kyotoSeed } from "@/lib/places/seed/kyoto";
import { osaka as osakaSeed } from "@/lib/places/seed/osaka";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { DAY_BUDGET_MINUTES, type TravelPace } from "@/lib/types";
import { parseClock } from "../filter";
import { eveningFrom, planDay } from "../schedule";
import { planTrip } from "../trip";
import { travelFromGraph } from "../travel";
import type { DayPlan, PlaceInput } from "../types";

const travel = travelFromGraph(buildGraph(stations, edges));
const cities: Record<string, PlaceInput[]> = {
  "kyoto-city": kyotoSeed.map((s) => seedToPlaceInput(s)),
  "osaka-city": osakaSeed.map((s) => seedToPlaceInput(s)),
};
const traveller = (pace: TravelPace, crowdTolerance: number) =>
  ({ pace, interestTags: [], energy: 0.5, crowdTolerance, discovery: 0.5, excludes: [], mobility: [], budgetBand: null });
const PACES: TravelPace[] = ["relaxed", "standard", "packed"];
// A Wednesday in May (nothing in these seeds closes on Wednesdays) and a
// Monday in November, when many museums close.
const DATES = ["2027-05-12", "2026-11-23"];

// The bound: the day may leave less than one stop's worth of time unused.
// The last stop can't be cut short to fit, so what's left can be up to a
// visit plus its train. Standard: 85%, 72 min left of 8 hours. Relaxed: 80%,
// 72 min of 6 hours: its visits are the full ones (45–180 min), so a gap of
// under an hour often holds none (a Monday in Kyoto leaves 55 min, and Kodai-ji
// alone takes 90). Packed: 70%, 7 of its 10 hours, still more than standard's
// bound (6h 48m). Its visits are the short ones (10–45 min), and most of
// Kyoto's and Osaka's sights close between 16:00 and 17:30, so the rest of its
// hours could only go to evening places, and the seeds hold few: the day stops
// rather than make one up. Before this change these days reached 39–55%
// packed and 63–80% standard (a fixed count of stops per pace: 4, 5, 7).
const MIN_SHARE: Record<TravelPace, number> = { relaxed: 0.8, standard: 0.85, packed: 0.7 };

/** The evening rule is time-of-day's (`eveningFrom`): a fuller day still
 *  never starts an evening-only place before its evening. */
const eveningProblems = (plan: DayPlan): string[] =>
  plan.items.flatMap((it) => {
    const from = eveningFrom(cities[plan.cityId].find((x) => x.id === it.placeId)!);
    return from != null && it.startMin < from ? [`${it.placeId} at ${it.startMin}, before its evening`] : [];
  });

describe("a day fills its pace's time", () => {
  for (const pace of PACES)
    for (const cityId of ["kyoto-city", "osaka-city"])
      it(`${pace} in ${cityId}: at least ${MIN_SHARE[pace] * 100}% of the budget used, never more`, () => {
        const bad: string[] = [];
        for (const date of DATES)
          for (const crowd of [0.2, 0.6]) {
            const plan = planDay({ date, cityId, places: cities[cityId], traveller: traveller(pace, crowd), travel });
            const at = `${date} crowd ${crowd}: ${plan.items.length} stops, ${plan.activeMin}/${plan.budgetMin}`;
            expect(plan.budgetMin).toBe(DAY_BUDGET_MINUTES[pace]);
            if (plan.activeMin < MIN_SHARE[pace] * plan.budgetMin) bad.push(`${at}: under ${MIN_SHARE[pace] * 100}%`);
            if (plan.activeMin > plan.budgetMin) bad.push(`${at}: over the budget`);
            if (!plan.meals.some((m) => m.kind === "lunch")) bad.push(`${at}: no lunch`);
            for (const e of eveningProblems(plan)) bad.push(`${at}: ${e}`);
            for (const it of plan.items) {
              const closes = parseClock(cities[cityId].find((x) => x.id === it.placeId)!.closesAt);
              if (closes != null && it.endMin > closes) bad.push(`${at}: ${it.placeId} runs past closing`);
            }
          }
        expect(bad).toEqual([]);
      });

  it("holds fewer stops relaxed than standard, and more packed", () => {
    for (const cityId of ["kyoto-city", "osaka-city"]) {
      const stops = PACES.map((pace) => planDay({ date: DATES[0], cityId, places: cities[cityId], traveller: traveller(pace, 0.6), travel }).items.length);
      expect(stops[0], `${cityId} ${stops}`).toBeLessThan(stops[1]);
      expect(stops[1], `${cityId} ${stops}`).toBeLessThan(stops[2]);
    }
  });

  it("shares a city's places across a long stay instead of spending them on the first days", () => {
    // Five packed days in Kyoto: days that each took 11–12 stops left the
    // fourth and fifth with one stop or none.
    const dates = ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28"];
    for (const crowd of [0.15, 0.6]) {
      const plan = planTrip({
        days: dates.map((date) => ({ date, cityId: "kyoto-city" })),
        traveller: traveller("packed", crowd), budgetByCity: {}, placesByCity: cities, travel,
      });
      const stops = plan.days.map((d) => d.items.length);
      expect(Math.min(...stops), `crowd ${crowd}: ${stops}`).toBeGreaterThanOrEqual(4);
    }
  });
});
