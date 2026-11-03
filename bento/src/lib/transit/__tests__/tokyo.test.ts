import { describe, expect, it } from "vitest";
import { buildGraph, route } from "../graph";
import * as kansai from "../seed/kansai-sanyo";
import * as tokyo from "../seed/tokyo";
import { tokyo as tokyoPlaces } from "@/lib/places/seed/tokyo";

// The Tokyo edges reach Kyoto and Shin-Osaka, so the graph needs both seeds.
const g = buildGraph([...kansai.stations, ...tokyo.stations], [...kansai.edges, ...tokyo.edges]);

describe("Tokyo transit seed", () => {
  it("shares no station id with the Kansai seed", () => {
    const kansaiIds = new Set(kansai.stations.map((s) => s.id));
    expect(tokyo.stations.filter((s) => kansaiIds.has(s.id)).map((s) => s.id)).toEqual([]);
    expect(new Set(tokyo.stations.map((s) => s.id)).size).toBe(tokyo.stations.length);
  });

  it("has every station the drafted Tokyo places point at", () => {
    const ids = new Set(tokyo.stations.map((s) => s.id));
    const missing = tokyoPlaces.map((p) => p.station).filter((s) => s != null && !ids.has(s));
    expect(missing).toEqual([]);
  });

  it("places every station inside the Kanto area", () => {
    for (const s of tokyo.stations) {
      expect(s.lat, s.id).toBeGreaterThan(35.3);
      expect(s.lat, s.id).toBeLessThan(36.0);
      expect(s.lon, s.id).toBeGreaterThan(139.1);
      expect(s.lon, s.id).toBeLessThan(140.5);
    }
  });

  it("gives every ride a distance and at least a minute", () => {
    for (const e of tokyo.edges) {
      expect(e.minutes, `${e.from}→${e.to}`).toBeGreaterThanOrEqual(1);
      if (e.mode === "rail") expect(e.km, `${e.from}→${e.to}`).toBeGreaterThan(0);
    }
  });

  it("reaches every Tokyo station from Tokyo Station", () => {
    const unreachable = tokyo.stations.filter((s) => s.id !== "tokyo" && route(g, "tokyo", s.id) == null).map((s) => s.id);
    expect(unreachable).toEqual([]);
  });
});

describe("route — Tokyo", () => {
  it("Shibuya → Asakusa is one Ginza Line ride at its published 33 minutes", () => {
    const r = route(g, "shibuya", "asakusa")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].line).toBe("Tokyo Metro Ginza Line");
    expect(r.legs[0].stops).toBe(18);
    expect(r.minutes).toBe(33);
  });

  it("prices a Metro run by its total distance: 14.2 km is the ¥252 band", () => {
    const r = route(g, "shibuya", "asakusa")!;
    expect(r.fareJpy).toBe(252);
    expect(r.fareKind).toBe("estimate");
  });

  it("never shows a JR ride as free while JR East's fare table is missing", () => {
    const r = route(g, "tokyo", "kanda")!;
    expect(r.legs[0].operator).toBe("jr-east");
    expect(r.unpricedRides).toBe(1);
    expect(r.fareJpy).toBe(0);
  });

  it("joins Tokyo to Kansai by the direct Nozomi", () => {
    const r = route(g, "tokyo", "kyoto")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].line).toBe("Tokaido Shinkansen · Nozomi");
    expect(r.fareKind).toBe("exact");
  });

  it("reaches both airports from Shinjuku", () => {
    expect(route(g, "shinjuku", "haneda-t3")).not.toBeNull();
    expect(route(g, "shinjuku", "narita-t1")).not.toBeNull();
  });

  it("walks between differently named stations instead of riding round", () => {
    const r = route(g, "harajuku", "meiji-jingumae")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].mode).toBe("walk");
  });

  it("prices a run that sums to a band edge in that band: Kasai → Kiba is 6.0 km, ¥178", () => {
    const r = route(g, "kasai", "kiba")!;
    expect(r.legs).toHaveLength(1);
    expect(r.fareJpy).toBe(178);
  });

  it("keeps one Metro fare across a designated transfer walk", () => {
    const r = route(g, "toranomon", "akasaka")!;
    expect(r.legs.map((l) => l.mode)).toEqual(["rail", "walk", "rail"]);
    expect(r.legs[1].from.id).toBe("tameike-sanno");
    expect(r.fareJpy).toBe(178);
  });

  it("makes the change at Tochomae from the Shinjuku stretch of the Oedo Line", () => {
    for (const [a, b] of [["shinjuku", "nishi-shinjuku-gochome"], ["nishi-shinjuku-gochome", "shinjuku"]]) {
      const r = route(g, a, b)!;
      expect(r.transfers, `${a}→${b}`).toBe(1);
    }
    // Loop trains run through Tochomae onto the Hikarigaoka branch.
    expect(route(g, "shinjuku-nishiguchi", "nishi-shinjuku-gochome")!.transfers).toBe(0);
  });

  it("reaches Koenji by a train that stops there every day", () => {
    for (const [a, b] of [["shinjuku", "koenji"], ["koenji", "shinjuku"]]) {
      const r = route(g, a, b)!;
      expect(r.legs.map((l) => l.line), `${a}→${b}`).toEqual(["JR Chuo-Sobu Line · Local"]);
    }
  });
});
