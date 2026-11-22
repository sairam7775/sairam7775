import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { hubFor, type CityFacts } from "@/lib/engine/route";
import { planTrip } from "@/lib/engine/trip";
import { eveningFrom, planDay } from "@/lib/engine/schedule";
import { travelFromGraph } from "@/lib/engine/travel";
import { cityTrainMinutes } from "@/lib/engine/travel-day";
import type { DayPlan, PlaceInput } from "@/lib/engine/types";
import type { TravelPace } from "@/lib/types";
import { copy } from "@/copy";
import { readyMadeTrips } from "@/lib/trips/ready-made";
import { READY_MADE_CITIES } from "@/lib/trips/ready-made/types";
import { readyMadeToPlan } from "@/lib/trips/ready-made/to-plan";

/** Places at the right time of day, on the ready-made trips as a traveller
 *  reads them: an evening place in the evening, and "unavoidable" only
 *  when it is. Read-through of 20 Nov: Pontocho ("Dead by day") at 11:00,
 *  Dotonbori ("on the first evening") at 09:30, and Kiyomizu-dera at
 *  09:00 called the unavoidable busiest hour. */
const graph = buildGraph(stations, edges);
const travel = travelFromGraph(graph);
const placesByCity: Record<string, PlaceInput[]> = {};
for (const p of placeSeeds.flatMap((s) => s.places)) (placesByCity[p.city] ??= []).push(seedToPlaceInput(p));
const facts = new Map<string, CityFacts>(
  READY_MADE_CITIES.map((id) => [id, { id, name: id, tier: "deep", verifiedPlaces: placesByCity[id]?.length ?? 0, transitNote: null, hubStation: hubFor(id, graph) }]),
);
const trainMinutes = cityTrainMinutes(graph, facts);
const MON = "2027-05-10";
const PACES: TravelPace[] = ["relaxed", "standard", "packed"];
const EVENING = 17 * 60 + 30;

const plan = (tripId: string, pace: TravelPace, crowdTolerance: number, start = MON): DayPlan[] => {
  const trip = readyMadeTrips.find((t) => t.id === tripId)!;
  return planTrip({
    days: readyMadeToPlan(trip, start).days,
    traveller: { pace, interestTags: [], energy: 0.5, crowdTolerance, discovery: 0.5, excludes: [], mobility: [] },
    budgetByCity: {},
    placesByCity,
    travel,
    trainMinutes,
  }).days;
};
const unavoidable = copy.plan.reasons.busiestHour;

describe("an evening place is planned in the evening, or left out with a reason", () => {
  it("never plans Pontocho by day", () => {
    for (const id of ["kyoto-east", "kyoto-2", "kyoto-arashiyama", "osaka-kyoto-nara-5"])
      for (const pace of PACES)
        for (const crowd of [0.2, 0.6])
          for (const day of plan(id, pace, crowd)) {
            const item = day.items.find((i) => i.placeId === "kyt-pontocho");
            if (item) expect(item.startMin, `${id} ${pace} ${crowd} ${day.date}`).toBeGreaterThanOrEqual(EVENING);
          }
  });

  it("says why when it leaves Pontocho out because the day ends before the evening", () => {
    // Three places and nothing else to add: the day is done by late
    // morning. (On a ready-made day, which fills to its cap, Pontocho is
    // left out like any other place the cap leaves out.)
    const three = placesByCity["kyoto-city"].filter((p) => ["kyt-kiyomizu", "kyt-ninenzaka", "kyt-pontocho"].includes(p.id));
    const day = planDay({ date: MON, cityId: "kyoto-city", places: three, travel,
      traveller: { pace: "standard", interestTags: [], energy: 0.5, crowdTolerance: 0.6, discovery: 0.5, excludes: [], mobility: [], budgetBand: null } });
    expect(day.items.map((i) => i.placeId).sort()).toEqual(["kyt-kiyomizu", "kyt-ninenzaka"]);
    expect(day.considered.find((r) => r.placeId === "kyt-pontocho")?.detail).toBe(copy.plan.leftOut.eveningOnly("17:30"));
  });

  it("puts Pontocho after an evening pin rather than say the day ends first", () => {
    // Kyoto East: Gion is pinned and timed for 17:30, so the day reaches
    // the evening. Pontocho goes after it, or is left out for another
    // reason (a full day), never "this day ends before then".
    for (const pace of PACES)
      for (const crowd of [0.2, 0.6]) {
        const [day] = plan("kyoto-east", pace, crowd);
        expect(day.items.find((i) => i.placeId === "kyt-gion")!.startMin).toBeGreaterThanOrEqual(EVENING);
        expect(day.considered.find((r) => r.placeId === "kyt-pontocho")?.detail, `${pace} ${crowd}`).not.toBe(copy.plan.leftOut.eveningOnly("17:30"));
      }
  });

  it("times a pinned Dotonbori into the evening, as the trip's words promise", () => {
    // "Dotonbori on the first evening" (osaka-kyoto-nara-5): it was at 09:40
    // to 13:50 on day 1 before this fix.
    expect(copy.readyMade.trips["osaka-kyoto-nara-5"].reasons["osaka-city"]).toMatch(/Dotonbori on the first evening/);
    for (const pace of PACES)
      for (const crowd of [0.2, 0.6]) {
        const [day] = plan("osaka-kyoto-nara-5", pace, crowd);
        const item = day.items.find((i) => i.placeId === "osk-dotonbori")!;
        expect(item.locked).toBe(true);
        expect(item.startMin, `${pace} ${crowd}`).toBeGreaterThanOrEqual(EVENING);
        expect(item.reason.toLowerCase()).toContain(copy.plan.reasons.evening);
        // It closes the day: nothing by day is planned after it.
        expect(day.items[day.items.length - 1].placeId === "osk-dotonbori" || day.items.slice(day.items.indexOf(item) + 1).every((i) => i.startMin >= EVENING)).toBe(true);
        // Lunch stays at lunchtime, not after the evening.
        for (const m of day.meals) expect(m.startMin).toBeLessThan(EVENING);
        // At most the free-time note before it.
        expect(day.warnings.filter((w) => /Dotonbori/.test(w) && w !== copy.plan.warnings.freeTime("17:30", "Dotonbori"))).toEqual([]);
      }
  });
});

describe("'unavoidable' is said only when it is", () => {
  it("does not call Kiyomizu-dera at 09:00 unavoidable: it says plainly when it is quieter", () => {
    const [day] = plan("kyoto-east", "standard", 0.6);
    const item = day.items.find((i) => i.placeId === "kyt-kiyomizu")!;
    expect(item.reason.toLowerCase()).not.toContain(unavoidable);
    expect(item.reason.toLowerCase()).toContain(copy.plan.reasons.busyNow("before 08:00").toLowerCase());
  });

  it("names both quiet windows for Fushimi Inari, which is also quiet after 17:30", () => {
    const days = plan("kyoto-nara-3", "standard", 0.6);
    const item = days.flatMap((d) => d.items).find((i) => i.placeId === "kyt-fushimi-inari")!;
    expect(item.startMin).toBeLessThan(EVENING);
    expect(item.reason.toLowerCase()).not.toContain(unavoidable);
    expect(item.reason.toLowerCase()).toContain(copy.plan.reasons.busyNow(`before 08:00${copy.plan.or}after 17:30`).toLowerCase());
  });

  it("says it on a travel day that arrives after the quiet window", () => {
    // Osaka → Kyoto, an early riser: the day starts at 08:13, Kiyomizu-dera
    // is quiet before 08:00 and has no evening window.
    const days = plan("osaka-kyoto-nara-5", "standard", 0.2);
    const item = days[2].items.find((i) => i.placeId === "kyt-kiyomizu")!;
    expect(days[2].startMin).toBeGreaterThan(8 * 60);
    expect(item.reason.toLowerCase()).toContain(unavoidable);
  });
});

describe("evening-only is the place's own flag, or its opening time", () => {
  const place = (id: string) => Object.values(placesByCity).flat().find((p) => p.id === id)!;

  it("counts a flagged place and one that opens at 17:00 or later, and no other", () => {
    expect(eveningFrom(place("kyt-pontocho"))).toBe(EVENING); // flagged: "Dead by day"
    expect(eveningFrom(place("tky-golden-gai"))).toBe(19 * 60); // flagged, opens 19:00
    expect(eveningFrom(place("tky-tsukishima"))).toBe(EVENING); // opens 17:00, best after 17:30
    // An evening best window alone is a soft preference: these may be by day.
    for (const id of ["kyt-gion", "osk-hozenji", "osk-dotonbori", "osk-umeda-sky", "tky-tokyo-tower"]) expect(eveningFrom(place(id)), id).toBeNull();
  });
});

describe("timing around an evening stop", () => {
  const osaka = placesByCity["osaka-city"];
  const traveller = { pace: "standard" as const, interestTags: [], energy: 0.5, crowdTolerance: 0.6, discovery: 0.5, excludes: [], mobility: [], budgetBand: null };

  it("reaches a pin timed after an evening stop on time", () => {
    // Dotonbori pinned (untimed, so timed for its evening) and Umeda Sky at
    // 18:00: the slotting used to count Dotonbori as done by mid-afternoon
    // and put Umeda Sky after it, reached late.
    const day = planDay({ date: MON, cityId: "osaka-city", places: osaka, traveller, travel,
      locked: [{ placeId: "osk-dotonbori" }, { placeId: "osk-umeda-sky", startMin: 18 * 60 }] });
    expect(day.items.find((i) => i.placeId === "osk-umeda-sky")!.startMin).toBe(18 * 60);
    expect(day.items.find((i) => i.placeId === "osk-dotonbori")!.startMin).toBeGreaterThanOrEqual(EVENING);
    expect(day.warnings.filter((w) => /pinned for/.test(w))).toEqual([]);
  });

  it("notes free time before a pinned evening stop the day waits over two hours for", () => {
    // Relaxed early riser: the day is done by early afternoon.
    const [day] = plan("osaka-kyoto-nara-5", "relaxed", 0.2);
    const item = day.items.find((i) => i.placeId === "osk-dotonbori")!;
    const prev = day.items[day.items.indexOf(item) - 1];
    expect(item.startMin - prev.endMin).toBeGreaterThan(120 + 60);
    expect(day.warnings).toContain(copy.plan.warnings.freeTime("17:30", "Dotonbori"));
  });
});

describe("a re-plan's kept start isn't a fixed start", () => {
  const kyoto = placesByCity["kyoto-city"];
  const traveller = { pace: "standard" as const, interestTags: [], energy: 0.5, crowdTolerance: 0.6, discovery: 0.5, excludes: [], mobility: [], budgetBand: null };
  const kiyomizu = (day: DayPlan) => day.items.find((i) => i.placeId === "kyt-kiyomizu")!.reason.toLowerCase();

  it("says 'unavoidable' only for a start the traveller named", () => {
    const base = { date: MON, cityId: "kyoto-city", places: kyoto, traveller, travel, locked: [{ placeId: "kyt-kiyomizu" }], dayStartMin: 9 * 60 };
    // A kept start (re-plan): an earlier start would reach before 08:00.
    expect(kiyomizu(planDay(base))).not.toContain(unavoidable);
    expect(kiyomizu(planDay(base))).toContain(copy.plan.reasons.busyNow("before 08:00").toLowerCase());
    // "Start at 09:00": the day can't start earlier.
    expect(kiyomizu(planDay({ ...base, startNamed: true }))).toContain(unavoidable);
  });
});
