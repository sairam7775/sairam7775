import { describe, expect, it } from "vitest";
import { hakone } from "../seed/hakone";
import { placeSeeds } from "../seed";
import { nikko } from "../seed/nikko";
import { stations } from "@/lib/transit/seed";

const stationCity = new Map(stations.map((s) => [s.id, s.cityId ?? null]));

describe.each([
  ["hakone.ts", "hakone", "hkn-", hakone],
  ["nikko.ts", "nikko", "nko-", nikko],
] as const)("%s drafts", (file, city, prefix, places) => {
  const ids = new Set(places.map((p) => p.id));

  it("is registered in the place seed index", () => {
    expect(placeSeeds.map((s) => s.file)).toContain(file);
  });

  it("has 10 to 12 places, all in the city, with the city's prefix", () => {
    expect(places.length).toBeGreaterThanOrEqual(10);
    expect(places.length).toBeLessThanOrEqual(12);
    for (const p of places) {
      expect(p.city, p.id).toBe(city);
      expect(p.id.startsWith(prefix), p.id).toBe(true);
    }
  });

  it("names a station of the same city, or none with the way there in the tip", () => {
    for (const p of places) {
      if (p.station == null) {
        expect(p.tip, p.id).toMatch(/shuttle|bus|walk/i);
      } else {
        expect(stationCity.get(p.station), `${p.id} → ${p.station}`).toBe(city);
      }
    }
  });

  it("links conflicts and pairs only within the batch, never to itself", () => {
    for (const p of places) {
      for (const other of [...(p.conflicts ?? []), ...(p.pairs ?? [])]) {
        expect(ids.has(other), `${p.id} → ${other}`).toBe(true);
        expect(other).not.toBe(p.id);
      }
    }
  });

  it("records a source for every place and keeps the hours same-day", () => {
    for (const p of places) {
      expect(p.sources.length, p.id).toBeGreaterThan(0);
      if (p.opens || p.closes) {
        expect(p.opens && p.closes, p.id).toBeTruthy();
        expect(p.closes! > p.opens!, p.id).toBe(true);
      }
      expect(p.taste, p.id).toBeLessThanOrEqual(p.typical);
      expect(p.typical, p.id).toBeLessThanOrEqual(p.full);
    }
  });

  // A tip outlives its notices: a dated closure goes stale in the seed.
  it("carries no dated notice in any tip", () => {
    expect(places.filter((p) => /\b20\d\d\b/.test(p.tip)).map((p) => p.id)).toEqual([]);
  });
});

describe("facts read from the places' own pages", () => {
  const byId = new Map([...hakone, ...nikko].map((p) => [p.id, p]));
  const get = (id: string) => {
    const p = byId.get(id);
    if (!p) throw new Error(`no place ${id}`);
    return p;
  };

  it("keeps Toshogu's winter hours and fee", () => {
    const p = get("nko-toshogu");
    expect([p.opens, p.closes, p.hoursVary, p.cost, p.station]).toEqual(["09:00", "16:00", true, 1600, "shinkyo"]);
  });

  it("closes the Tamozawa villa on Tuesdays", () => {
    const p = get("nko-tamozawa");
    expect([p.closedWeekdays, p.cost, p.station, p.walk]).toEqual([[2], 600, "tamozawa", 1]);
  });

  it("keeps the Hakone Open-Air Museum's hours, counter price and 2-minute walk", () => {
    const p = get("hkn-open-air-museum");
    expect([p.opens, p.closes, p.cost, p.station, p.walk]).toEqual(["09:00", "17:00", 2000, "chokoku-no-mori", 2]);
  });

  it("puts the Pola Museum on the free shuttle from Gora, not a station", () => {
    const p = get("hkn-pola-museum");
    expect(p.station).toBeNull();
    expect(p.tip).toContain("free shuttle");
    expect(p.cost).toBe(2200);
  });

  it("keeps the Hakone Checkpoint's winter closing and Gora Park's winter hours", () => {
    expect([get("hkn-checkpoint").closes, get("hkn-checkpoint").cost]).toEqual(["16:30", 500]);
    expect([get("hkn-gora-park").opens, get("hkn-gora-park").closes, get("hkn-gora-park").cost]).toEqual(["09:30", "16:30", 650]);
  });
});
