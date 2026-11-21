import { describe, expect, it } from "vitest";
import { CITY_WINDOWS, PLACE_WINDOWS, seasonsOn } from "../seasons";
import { allPlaces } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { scorePlace, DEFAULT_WEIGHTS } from "../score";
import { planDay } from "../schedule";
import { travelFromGraph } from "../travel";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed/kansai-sanyo";
import { kyoto, owner } from "../__fixtures__/kyoto";
import { copy } from "@/copy";

const kyt = { id: "kyt-x", cityId: "kyoto-city" };
const nara = { id: "nar-x", cityId: "nara-city" };
const tokyo = { id: "tky-x", cityId: "tokyo-city" };

describe("seasonsOn — typical windows, not whole months", () => {
  it("makes no autumn-colour claim in Kyoto on 31 December", () => {
    expect(seasonsOn("2026-12-31", kyt)).toEqual([]);
  });

  it("makes no cherry-blossom claim in Kyoto or Nara on 8–10 March", () => {
    for (const d of ["2027-03-08", "2027-03-10"]) {
      expect(seasonsOn(d, kyt)).toEqual([]);
      expect(seasonsOn(d, nara)).toEqual([]);
    }
  });

  it("knows Kyoto's cherry blossom on 1 April and its autumn colour on 25 November", () => {
    expect(seasonsOn("2027-04-01", kyt)).toEqual(["sakura"]);
    expect(seasonsOn("2026-11-25", kyt)).toEqual(["koyo"]);
  });

  it("follows each city's own window: Tokyo's colour lasts past Kyoto's", () => {
    expect(seasonsOn("2026-12-15", tokyo)).toEqual(["koyo"]);
    expect(seasonsOn("2026-12-15", kyt)).toEqual([]);
    // Tokyo's blossom typically runs late March to early April, like Kyoto's.
    expect(seasonsOn("2027-04-05", tokyo)).toEqual(["sakura"]);
    expect(seasonsOn("2027-04-05", kyt)).toEqual(["sakura"]);
    expect(seasonsOn("2027-04-11", tokyo)).toEqual([]);
  });

  it("starts Nara's blossom in late March (Somei-Yoshino), not April", () => {
    expect(seasonsOn("2027-03-25", nara)).toEqual(["sakura"]);
    expect(seasonsOn("2027-03-20", nara)).toEqual([]);
  });

  it("goes by the place's own city, not the day's: a Miyajima stop on a Hiroshima day", () => {
    const miyajima = seedToPlaceInput(allPlaces.find((p) => p.id === "miy-momijidani")!, { tier: "outline", status: "verified" });
    const hiroshima = seedToPlaceInput(allPlaces.find((p) => p.city === "hiroshima-city" && p.seasons?.includes("koyo"))!, { tier: "outline", status: "verified" });
    // 15 November: inside Miyajima's window (mid to late November), before
    // Hiroshima's (late November).
    const fit = (p: typeof miyajima) =>
      scorePlace(p, owner, { categoryCounts: new Map(), remainingMin: 480, date: "2026-11-15" }).terms.find((x) => x.term === "season_fit")!;
    expect(fit(miyajima).value).toBe(1);
    expect(fit(miyajima).clause).toMatch(/autumn colour/);
    expect(fit(hiroshima).value).toBe(0.3);
    expect(fit(hiroshima).clause).toBeUndefined();
  });

  it("keeps every window inside one year and points every area override at a real place", () => {
    const all = [...Object.values(CITY_WINDOWS), ...Object.values(PLACE_WINDOWS)].flatMap((c) => Object.values(c));
    expect(all.length).toBeGreaterThan(0);
    for (const win of all) {
      const [fm, fd] = win.from;
      const [tm, td] = win.to;
      expect(fm * 100 + fd).toBeLessThanOrEqual(tm * 100 + td);
      for (const [m, d] of [win.from, win.to]) {
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(12);
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(31);
      }
    }
    const ids = new Set(allPlaces.map((p) => p.id));
    for (const id of Object.keys(PLACE_WINDOWS)) expect(ids.has(id), id).toBe(true);
    const cities = new Set(allPlaces.map((p) => p.city));
    for (const city of Object.keys(CITY_WINDOWS)) expect(cities.has(city), city).toBe(true);
  });

  it("colours Okunikko weeks before Nikko's shrines", () => {
    expect(seasonsOn("2026-10-15", { id: "nko-lake-chuzenji", cityId: "nikko" })).toEqual(["koyo"]);
    expect(seasonsOn("2026-10-15", { id: "nko-toshogu", cityId: "nikko" })).toEqual([]);
    expect(seasonsOn("2026-11-15", { id: "nko-toshogu", cityId: "nikko" })).toEqual(["koyo"]);
  });

  it("claims nothing for a city it has no windows for", () => {
    expect(seasonsOn("2026-11-25", { id: "x", cityId: "takayama" })).toEqual([]);
  });

  it("includes both ends of a window", () => {
    expect(seasonsOn("2026-11-11", kyt)).toEqual(["koyo"]);
    expect(seasonsOn("2026-12-10", kyt)).toEqual(["koyo"]);
    expect(seasonsOn("2026-11-10", kyt)).toEqual([]);
    expect(seasonsOn("2026-12-11", kyt)).toEqual([]);
  });
});

describe("season fit in the score", () => {
  const tofukuji = kyoto.find((x) => x.id === "kyt-tofukuji")!;
  const fit = (date: string) =>
    scorePlace(tofukuji, owner, { categoryCounts: new Map(), remainingMin: 480, date })
      .terms.find((x) => x.term === "season_fit")!;

  it("counts as in season only inside the window, at the same weight", () => {
    const inside = fit("2026-11-25");
    const lateDec = fit("2026-12-31");
    expect(inside.value).toBe(1);
    expect(inside.weight).toBe(DEFAULT_WEIGHTS.seasonFit);
    expect(lateDec.value).toBe(0.3);
    expect(lateDec.clause).toBeUndefined();
  });

  it("says the season usually peaks around now, never that it is at its best now", () => {
    const clause = fit("2026-11-25").clause!;
    expect(clause).toBe(copy.plan.reasons.inSeason(copy.plan.seasons.koyo));
    expect(clause).toBe("usually at its best around now — autumn colour");
    expect(clause).not.toMatch(/^at its best now/);
  });

  it("leaves autumn colour out of a Kyoto plan on 31 December", () => {
    const travel = travelFromGraph(buildGraph(stations, edges));
    const plan = planDay({ date: "2026-12-31", cityId: "kyoto-city", places: kyoto, traveller: owner, travel });
    expect(plan.items.length).toBeGreaterThan(0);
    for (const item of plan.items) expect(item.reason).not.toMatch(/autumn colour/);
  });
});
