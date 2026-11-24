import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { hubFor, type CityFacts } from "@/lib/engine/route";
import { planTrip } from "@/lib/engine/trip";
import { planDay } from "@/lib/engine/schedule";
import { daylightEndMin, sunsetMin } from "@/lib/engine/daylight";
import { travelFromGraph } from "@/lib/engine/travel";
import { cityTrainMinutes } from "@/lib/engine/travel-day";
import type { DayPlan, PlaceInput, TravellerInput } from "@/lib/engine/types";
import { copy } from "@/copy";
import { readyMadeTrips } from "@/lib/trips/ready-made";
import { READY_MADE_CITIES } from "@/lib/trips/ready-made/types";
import { readyMadeToPlan } from "@/lib/trips/ready-made/to-plan";
import { closedMustSees } from "@/lib/trips/ready-made/closed";

/** Place data from the live read-through of 23 Nov 2026: a hike planned
 *  into the December dusk, Tsukiji pinned on a Wednesday with no word that
 *  many shops shut, Omoide Yokocho at 15:15, no "book ahead" on Shibuya Sky
 *  or Kabuki-za, and Fudoin with no station. */
const graph = buildGraph(stations, edges);
const travel = travelFromGraph(graph);
const allSeeds = placeSeeds.flatMap((s) => s.places);
const placesByCity: Record<string, PlaceInput[]> = {};
for (const p of allSeeds) (placesByCity[p.city] ??= []).push(seedToPlaceInput(p));
const facts = new Map<string, CityFacts>(
  READY_MADE_CITIES.map((id) => [id, { id, name: id, tier: "deep", verifiedPlaces: placesByCity[id]?.length ?? 0, transitNote: null, hubStation: hubFor(id, graph) }]),
);
const trainMinutes = cityTrainMinutes(graph, facts);
const traveller: TravellerInput = { pace: "standard", interestTags: [], energy: 0.5, crowdTolerance: 0.6, discovery: 0.5, excludes: [], mobility: [], budgetBand: null };

const plan = (tripId: string, start: string): DayPlan[] => {
  const trip = readyMadeTrips.find((t) => t.id === tripId)!;
  return planTrip({
    days: readyMadeToPlan(trip, start).days,
    traveller: { pace: "standard", interestTags: [], energy: 0.5, crowdTolerance: 0.6, discovery: 0.5, excludes: [], mobility: [] },
    budgetByCity: {},
    placesByCity,
    travel,
    trainMinutes,
  }).days;
};
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

describe("sunset", () => {
  // Tokyo (35.6895, 139.6917). NAOJ's almanac gives sunset about 16:32 on
  // 21 Dec and 19:00 on 21 Jun; the approximation is good to a few minutes.
  it("is about 16:32 in Tokyo at the winter solstice and 19:00 at the summer one", () => {
    expect(Math.abs(sunsetMin("2026-12-21", 35.6895, 139.6917) - (16 * 60 + 32))).toBeLessThanOrEqual(3);
    expect(Math.abs(sunsetMin("2027-06-21", 35.6895, 139.6917) - (19 * 60 + 0))).toBeLessThanOrEqual(3);
  });

  it("is later in the west: Hiroshima sets about 25 min after Tokyo", () => {
    const d = sunsetMin("2026-12-21", 34.3853, 132.4553) - sunsetMin("2026-12-21", 35.6895, 139.6917);
    expect(d).toBeGreaterThanOrEqual(20);
    expect(d).toBeLessThanOrEqual(35);
  });

  it("ends a hike's daylight an hour before sunset, and only a hike's", () => {
    const hike = placesByCity.kamakura.find((p) => p.id === "kmk-kuzuharaoka")!;
    expect(daylightEndMin(hike, "2026-12-16")).toBe(sunsetMin("2026-12-16", hike.lat!, hike.lon!) - 60);
    expect(daylightEndMin(placesByCity.kamakura.find((p) => p.id === "kmk-kotoku-in")!, "2026-12-16")).toBeNull();
    expect(daylightEndMin({ ...hike, lat: null, lon: null }, "2026-12-16")).toBeNull();
  });
});

describe("Osaka Castle on a travel day", () => {
  // Official hours 09:00–18:00, last entry 17:30 (osakacastle.net/guide/,
  // since 1 Apr 2025). A visit ends by closing, so it starts before last entry.
  it("is pinned on all-nine-14's move day and ends by closing, entering before 17:30", () => {
    for (const start of ["2026-12-01", "2027-05-10"]) {
      const day = plan("all-nine-14", start)[9];
      const castle = day.items.find((x) => x.placeId === "osk-osaka-castle")!;
      expect(castle.endMin).toBeLessThanOrEqual(18 * 60);
      expect(castle.startMin).toBeLessThanOrEqual(17 * 60 + 30);
    }
  }, 60_000);
});

describe("a hike ends in daylight", () => {
  it("never plans the Kamakura trail into a December dusk (read-through: 14:45–16:15)", () => {
    const seed = placesByCity.kamakura.find((p) => p.id === "kmk-kuzuharaoka")!;
    for (const start of ["2026-12-03", "2026-12-16", "2027-01-10"]) {
      const day = plan("kamakura-day", start)[0];
      const hike = day.items.find((x) => x.placeId === "kmk-kuzuharaoka");
      if (!hike) continue;
      expect(hike.endMin, `${start}: ends ${clock(hike.endMin)}`).toBeLessThanOrEqual(sunsetMin(start, seed.lat!, seed.lon!) - 60);
    }
  });

  it("plans the trail on a Kamakura day when it fits daylight (so the check above isn't empty)", () => {
    expect(plan("kamakura-day", "2026-12-16")[0].items.map((x) => x.placeId)).toContain("kmk-kuzuharaoka");
  });

  it("leaves a late hike out with the daylight reason, where summer light would take it (review finding 6)", () => {
    const hike = placesByCity.kamakura.find((p) => p.id === "kmk-kuzuharaoka")!;
    const at = (date: string) => planDay({ date, cityId: "kamakura", places: [hike], traveller, travel, dayStartMin: 14 * 60 + 30 });
    expect(at("2027-06-16").items.map((x) => x.placeId)).toEqual(["kmk-kuzuharaoka"]);
    const dec = at("2026-12-16");
    expect(dec.items).toEqual([]);
    expect(dec.considered.find((r) => r.placeId === hike.id)?.detail).toContain("in the dark");
  });

  it("warns when a pinned hike can only run into the dark", () => {
    const day = planDay({ date: "2026-12-16", cityId: "kamakura", places: placesByCity.kamakura, traveller, travel, dayStartMin: 15 * 60, locked: [{ placeId: "kmk-kuzuharaoka" }] });
    expect(day.items.map((x) => x.placeId)).toContain("kmk-kuzuharaoka");
    expect(day.warnings.some((w) => w.includes("Kuzuharaoka") && /dark/.test(w))).toBe(true);
  });

  it("tells the traveller the trail can be walked from the Great Buddha end", () => {
    const seed = allSeeds.find((p) => p.id === "kmk-kuzuharaoka")!;
    expect(seed.tip).toMatch(/Daibutsu-zaka/);
  });
});

describe("Tsukiji Outer Market on a Wednesday or Sunday", () => {
  const WED = "2026-12-09";
  it("is not chosen by the planner on those days", () => {
    for (const date of [WED, "2026-12-13"]) {
      const day = planDay({ date, cityId: "tokyo-city", places: placesByCity["tokyo-city"], traveller, travel });
      expect(day.items.map((x) => x.placeId)).not.toContain("tky-tsukiji-outer");
      expect(day.considered.find((r) => r.placeId === "tky-tsukiji-outer")?.detail).toMatch(/many of its shops close on (Wednesday|Sunday)s/);
    }
  });

  it("stays when pinned, with a plain warning that many shops are shut", () => {
    const day = planDay({ date: WED, cityId: "tokyo-city", places: placesByCity["tokyo-city"], traveller, travel, locked: [{ placeId: "tky-tsukiji-outer" }] });
    expect(day.items.map((x) => x.placeId)).toContain("tky-tsukiji-outer");
    expect(day.warnings.some((w) => w.includes("Tsukiji Outer Market") && w.includes("Wednesdays"))).toBe(true);
    expect(day.warnings.some((w) => /pinned/i.test(w))).toBe(false);
  });

  it("a real closing outranks 'many shops close' for a pin (review finding 5)", () => {
    const tsukiji = placesByCity["tokyo-city"].find((p) => p.id === "tky-tsukiji-outer")!;
    const places = placesByCity["tokyo-city"].map((p) => (p.id === tsukiji.id ? { ...p, closedDates: [WED] } : p));
    const day = planDay({ date: WED, cityId: "tokyo-city", places, traveller, travel, locked: [{ placeId: tsukiji.id }] });
    expect(day.warnings.some((w) => w.includes("Tsukiji Outer Market") && w.includes(copy.plan.leftOut.closedDate))).toBe(true);
  });

  it("is planned as usual on a Tuesday", () => {
    const day = planDay({ date: "2026-12-08", cityId: "tokyo-city", places: placesByCity["tokyo-city"], traveller, travel, locked: [{ placeId: "tky-tsukiji-outer" }] });
    expect(day.warnings.some((w) => w.includes("Tsukiji Outer Market"))).toBe(false);
  });

  it("doesn't refuse a ready-made start that pins it on a Wednesday (part of the market is open)", () => {
    const trip = readyMadeTrips.find((t) => t.id === "tokyo-kamakura-yokohama-5")!;
    const byId = new Map(allSeeds.map((p) => [p.id, p]));
    // Day 2 is Tsukiji's day; a Tuesday start puts it on a Wednesday.
    expect(trip.mustSee[1]).toContain("tky-tsukiji-outer");
    expect(closedMustSees(trip, "2026-12-08", byId)).toEqual([]);
  });
});

describe("Omoide Yokocho", () => {
  it("is evening-only, so never planned by day (read-through: 15:15)", () => {
    expect(allSeeds.find((p) => p.id === "tky-omoide-yokocho")!.eveningOnly).toBe(true);
    for (const start of ["2026-12-09", "2027-05-10"]) {
      for (const day of plan("tokyo-2", start)) {
        const x = day.items.find((i) => i.placeId === "tky-omoide-yokocho");
        if (x) expect(x.startMin, `${start} ${day.date}`).toBeGreaterThanOrEqual(17 * 60 + 30);
      }
    }
  });
});

describe("booking cues on the day card", () => {
  it("says to book ahead on a place that recommends booking", () => {
    const day = planDay({ date: "2026-12-08", cityId: "tokyo-city", places: placesByCity["tokyo-city"], traveller, travel, locked: [{ placeId: "tky-shibuya-sky" }] });
    const sky = day.items.find((x) => x.placeId === "tky-shibuya-sky")!;
    expect(sky.reason.toLowerCase()).toContain(copy.plan.reasons.bookAhead(14).toLowerCase());
  });

  it("says a performance runs at set times, and to book", () => {
    const day = planDay({ date: "2026-12-08", cityId: "tokyo-city", places: placesByCity["tokyo-city"], traveller, travel, locked: [{ placeId: "tky-kabukiza" }] });
    const kabuki = day.items.find((x) => x.placeId === "tky-kabukiza")!;
    expect(kabuki.reason.toLowerCase()).toContain(copy.plan.reasons.bookAhead(1).toLowerCase());
    expect(kabuki.reason.toLowerCase()).toContain(copy.plan.reasons.setTimes.toLowerCase());
  });

  it("says how far ahead to book, never that tickets go on sale then (review finding 4: the lead is a booking interval, not a release date)", () => {
    expect(copy.plan.reasons.bookAhead(3)).toBe("book about 3 days ahead");
    expect(copy.plan.reasons.bookAhead(1)).toBe("book a day ahead");
    expect(copy.plan.reasons.bookAhead(null)).toBe("book ahead");
    for (const lead of [null, 1, 3, 14]) expect(copy.plan.reasons.bookAhead(lead)).not.toMatch(/on sale|release/);
  });

  it("says nothing of booking for a place that needs none", () => {
    const day = planDay({ date: "2026-12-08", cityId: "tokyo-city", places: placesByCity["tokyo-city"], traveller, travel, locked: [{ placeId: "tky-sensoji" }] });
    expect(day.items.find((x) => x.placeId === "tky-sensoji")!.reason.toLowerCase()).not.toContain("book");
  });
});

describe("Fudoin", () => {
  it("has a station, so a leg to it is a train, not the 45-minute guess", () => {
    const hir = placesByCity["hiroshima-city"];
    const fudoin = hir.find((p) => p.id === "hir-fudoin")!;
    expect(fudoin.nearestStation).toBe("fudoin-mae");
    const leg = travel(hir.find((p) => p.id === "hir-memorial-hall")!, fudoin);
    expect(leg).not.toBeNull();
    expect(leg!.lines.map((l) => JSON.stringify(l)).join(" ")).toMatch(/Astram/);
  });
});
