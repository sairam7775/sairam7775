import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { hubFor, type CityFacts } from "@/lib/engine/route";
import { planTrip, type TripPlan } from "@/lib/engine/trip";
import { travelFromGraph } from "@/lib/engine/travel";
import { parseClock, parseWindow } from "@/lib/engine/filter";
import { eveningFrom, usualDayStart } from "@/lib/engine/schedule";
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
 *  `detourKm` (a kilometre and a half unless said) through stops between.
 *  A return to an evening stop doesn't count when it is in its evening:
 *  the day ends there wherever it began, and that is not the ordering's to
 *  fix. Its evening starts at its opening (17:00 or later), its evening-only
 *  start (`eveningFrom`), or its evening best window ("after 17:30"). */
const returns = (day: DayPlan, detourKm = 1.5): string[] => {
  const ids = day.items.map((i) => i.placeId);
  const out: string[] = [];
  const eveningAt = (k: number): number | null => {
    const seed = seedById.get(ids[k])!;
    const opens = parseClock(seed.opens ?? null) ?? 0;
    const wins = (seed.window ?? []).map(parseWindow);
    const window = wins.length && wins.every((w) => w.after != null && w.after >= 17 * 60) ? Math.min(...wins.map((w) => w.after!)) : null;
    return eveningFrom(seedToPlaceInput(seed)) ?? window ?? (opens >= 17 * 60 ? opens : null);
  };
  const evening = (k: number) => { const at = eveningAt(k); return at != null && day.items[k].startMin >= at; };
  for (let i = 0; i < ids.length; i++)
    for (let k = i + 2; k < ids.length; k++) {
      const direct = km(ids[i], ids[k]);
      if (direct > 0.6 || evening(k)) continue;
      let path = 0;
      for (let j = i; j < k; j++) path += km(ids[j], ids[j + 1]);
      if (path - direct > detourKm) out.push(`${day.date}: ${ids.slice(i, k + 1).join(" > ")}`);
    }
  return out;
};

/** Every trip out of the day's way: one or two stops the planner chose, in a
 *  row, that take the day more than `detourKm` further than the straight
 *  line between the stops either side. A pin is where the traveller chose
 *  to be, so it is never one. */
const detours = (day: DayPlan, detourKm = 3.5): string[] => {
  const ids = day.items.map((i) => i.placeId);
  const out: string[] = [];
  for (let k = 1; k + 1 < ids.length; k++)
    for (let w = 1; w <= 2 && k + w < ids.length; w++) {
      if (day.items.slice(k, k + w).some((i) => i.locked)) break;
      let path = 0;
      for (let j = k - 1; j < k + w; j++) path += km(ids[j], ids[j + 1]);
      if (path - km(ids[k - 1], ids[k + w]) > detourKm * w) out.push(`${day.date}: ${ids.slice(k - 1, k + w + 1).join(" > ")}`);
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

  it("Kyoto's east side: the east bank before the walk west to the river, and Gion in the evening", () => {
    for (const [tripId, i] of [["kyoto-east", 0], ["osaka-kyoto-nara-5", 2]] as const) {
      const day = plan(tripId).days[i];
      const ids = names(day);
      expect(returns(day), ids.join(" > ")).toEqual([]);
      // Gion is an evening place ("after 17:30"), so it ends the day
      // (time-of-day.test.ts). By day: from Kiyomizu-dera, once the day is
      // west of the river's east bank it doesn't come back east.
      const from = ids.indexOf("kyt-kiyomizu");
      const to = ids.indexOf("kyt-gion");
      expect(from, ids.join(" > ")).toBeGreaterThanOrEqual(0);
      expect(to, ids.join(" > ")).toBeGreaterThan(from);
      expect(day.items[to].startMin, ids.join(" > ")).toBeGreaterThanOrEqual(17 * 60 + 30);
      const byDay = ids.slice(from + 1, to);
      const firstWest = byDay.findIndex((id) => seedById.get(id)!.lon <= 135.772);
      if (firstWest >= 0) for (const id of byDay.slice(firstWest)) expect(seedById.get(id)!.lon, `${tripId}: ${ids.join(" > ")}`).toBeLessThanOrEqual(135.772);
      // Under 48 min when these days held five stops at most. A day that
      // grows until its time is spent holds seven, all on the east side:
      // every stop within 2 km of Gion, where it ends, not out to Kyoto
      // Tower and Nijo Castle and back (78 min). Seven stops a walk apart
      // take about 65 min of travel (Nishiki Market to Gion by the river).
      expect(travelMin(day), ids.join(" > ")).toBeLessThan(70);
      // Nor does it open with the day waiting: Nishiki Market, moved first for
      // its quiet morning, once kept a 09:00 day waiting until 10:00.
      expect(day.warnings.filter((w) => /the day waits/.test(w)), ids.join(" > ")).toEqual([]);
      if (tripId === "kyoto-east") expect(day.items[0].startMin - usualDayStart(0.6), ids.join(" > ")).toBeLessThanOrEqual(20);
      for (const id of ids) expect(km(id, "kyt-gion"), `${tripId}: ${ids.join(" > ")}`).toBeLessThan(2);
    }
  });

  it("Arashiyama: along the river to the bamboo path and up to Okochi Sanso, not down and back up", () => {
    for (const [tripId, i] of [["osaka-kyoto-nara-5", 4], ["kyoto-2", 1], ["kyoto-arashiyama", 0]] as const) {
      const day = plan(tripId).days[i];
      expect(returns(day), `${tripId}: ${names(day).join(" > ")}`).toEqual([]);
    }
  });

  it("Himeji, packed: not out to Mount Shosha and back to Otokoyama beside the castle", () => {
    // Otokoyama is steep with no station: before it could walk straight it
    // cost the flat 45-minute guess from anywhere, and the day went castle
    // > Engyoji > back to Otokoyama, a detour of over 10 km.
    for (const start of ["2027-05-10", "2027-05-12", "2026-11-24"]) {
      const day = plan("kansai-hiroshima-7", start, "packed", 0.6).days[2];
      expect(day.cityId).toBe("himeji");
      expect(returns(day, 3.5), names(day).join(" > ")).toEqual([]);
    }
  });

  it("Tokyo, packed: from Senso-ji south across the city, not back up to Kappabashi beside it", () => {
    // A packed day of up to 12 stops once went Senso-ji > Tsukiji >
    // Kabuki-za > Kappabashi (700 m from Senso-ji) > Ueno: across town and
    // back. A return here is also one back to within a quarter of the way
    // round, as the planner counts it across a city.
    for (const crowd of [0.2, 0.6])
      for (const start of ["2027-05-10", "2027-05-12"]) {
        const day = plan("tokyo-2", start, "packed", crowd).days[0];
        expect(returns(day), `${crowd} ${start}: ${names(day).join(" > ")}`).toEqual([]);
        const ids = names(day);
        const k = ids.indexOf("tky-kabukiza");
        if (k >= 0) for (const id of ids.slice(k + 1)) {
          if (eveningFrom(seedToPlaceInput(seedById.get(id)!)) == null) expect(km(id, "tky-sensoji"), `${crowd} ${start}: ${ids.join(" > ")}`).toBeGreaterThan(1.5);
        }
      }
    // Four packed Tokyo trips over the Kanto network: seconds on a busy runner.
  }, 30_000);

  // Found reading the newly shown trips on 23 Nov (December starts, the
  // standard pace). A stop that opened the day across town was moved
  // between two others by ordering, or a day ran on across the city and
  // back: none is now more than 3.5 km off the line between its neighbours.
  it("Tokyo day 2: no filler across town and back while the day waits for Shibuya at 17:30", () => {
    // Before: Shinjuku Gyoen > Tsukiji Hongan-ji (26 min east) > Shibuya
    // Crossing (26 min back west), a detour of 9.6 km.
    for (const [tripId, start, i] of [["all-nine-14", "2026-12-09", 1], ["classic-7", "2026-12-10", 1], ["tokyo-to-miyajima-10", "2026-12-07", 1]] as const) {
      const day = plan(tripId, start).days[i];
      expect(day.items.some((it) => it.placeId === "tky-shibuya-crossing"), `${tripId}: ${names(day).join(" > ")}`).toBe(true);
      expect(detours(day), `${tripId}: ${names(day).join(" > ")}`).toEqual([]);
    }
  });

  it("Kyoto: Arashiyama days don't zigzag to Fushimi or the Kamo river and back", () => {
    // Before: classic-7 day 7 went Okochi Sanso > Fushimi sake district >
    // Philosopher's Path (west, south, north-east); tokyo-to-miyajima-10
    // day 5 went Togetsukyo > Nijo Castle > Kamo river > back north-west
    // to Kinkaku-ji.
    for (const [tripId, start, i] of [["classic-7", "2026-12-10", 6], ["tokyo-to-miyajima-10", "2026-12-07", 4]] as const) {
      const day = plan(tripId, start).days[i];
      expect(day.cityId).toBe("kyoto-city");
      expect(detours(day), `${tripId}: ${names(day).join(" > ")}`).toEqual([]);
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
  // Days known to loop back, kept for now by the manager rather than
  // fixed, "<trip> <pace> <crowd> <return>" as reported below. Empty: the
  // Tokyo day that went Kabuki-za > Hama-rikyu > Mori Art Museum > Ginza
  // (packed, early riser, 10 May 2027) no longer does since evening-only
  // places became an explicit flag. Kept, for the manager to judge (24 Nov):
  // the relaxed early riser's first Tokyo day, Senso-ji at dawn, Tsukiji's
  // market in its morning, then Kiyosumi Garden. A day of four stops or
  // fewer keeps them rather than lose one off the way (schedule.ts,
  // `offTheWay`), so a long stay's last day isn't stripped to two.
  const KNOWN_LOOPS = new Set<string>([
    ...["tokyo-2", "tokyo-kamakura-3"].flatMap((trip) => ["2027-05-10", "2027-05-12"].map((date) =>
      `${trip} relaxed 0.2 detour ${date}: tky-sensoji > tky-tsukiji-outer > tky-kiyosumi-garden`)),
  ]);
  it("no ready-made day crosses town and comes back, at any pace or start time", () => {
    const bad: string[] = [];
    const known: string[] = [];
    for (const trip of readyMadeTrips)
      for (const pace of ["relaxed", "standard", "packed"] as const)
        for (const crowd of [0.2, 0.6])
          for (const start of ["2027-05-10", "2027-05-12", "2026-11-24"])
            for (const day of plan(trip.id, start, pace, crowd).days) for (const r of [...returns(day, 3.5), ...detours(day).map((d) => `detour ${d}`)]) {
              const key = `${trip.id} ${pace} ${crowd} ${r}`;
              (KNOWN_LOOPS.has(key) ? known : bad).push(key);
            }
    expect(bad).toEqual([]);
    // When one is fixed, take it off KNOWN_LOOPS.
    expect(known.sort()).toEqual([...KNOWN_LOOPS].sort());
  }, 60_000);
});
