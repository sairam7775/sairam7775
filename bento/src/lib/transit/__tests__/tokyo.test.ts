import { describe, expect, it } from "vitest";
import { buildGraph, FEWER_CHANGES_SLACK_MIN, route } from "../graph";
import { edges as allEdges, stations as allStations } from "../seed";
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

  it("prices a JR ride from JR East's table: Tokyo → Kanda is 1.3 km, ¥155", () => {
    const r = route(g, "tokyo", "kanda")!;
    expect(r.legs[0].operator).toBe("jr-east");
    expect(r.unpricedRides).toBe(0);
    expect(r.fareJpy).toBe(155);
  });

  it("never shows a ride on an operator with no fare table as free", () => {
    const r = route(g, "shimbashi", "odaiba-kaihinkoen")!;
    expect(r.legs.map((l) => l.line)).toEqual(["Yurikamome"]);
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

  it("warns of the change at Tochomae for loop trains from Shinjuku-nishiguchi", () => {
    // The router has one Oedo line, so the change is a note on the leg;
    // trains via Shinjuku run through to the Hikarigaoka branch.
    const r = route(g, "shinjuku-nishiguchi", "nishi-shinjuku-gochome")!;
    expect(r.legs[0].notes.join(" ")).toContain("change there for the Hikarigaoka branch");
    const through = route(g, "shinjuku", "nishi-shinjuku-gochome")!;
    expect(through.transfers).toBe(0);
    expect(through.legs[0].notes).toEqual([]);
    expect(route(g, "yoyogi", "tochomae")!.transfers).toBe(0);
  });

  it("reaches Koenji by a train that stops there every day", () => {
    for (const [a, b] of [["shinjuku", "koenji"], ["koenji", "shinjuku"]]) {
      const r = route(g, a, b)!;
      expect(r.legs.map((l) => l.line), `${a}→${b}`).toEqual(["JR Chuo-Sobu Line · Local"]);
    }
  });
});

describe("route — inside a city the fastest route stands", () => {
  // Between cities a route with fewer changes may be up to 20 minutes
  // slower; inside a city that would double short hops. Over every seed,
  // so the Kanagawa lines through Shibuya are in the graph too.
  const all = buildGraph(allStations, allEdges);
  it.each([
    ["omotesando", "shinanomachi"], // 17 minutes; the window would take 33
    ["nijo", "katsura"], // Kyoto, in the same graph: 21; the window would take 38
  ])("%s → %s keeps the fastest route, with its change", (a, b) => {
    const r = route(all, a, b)!;
    const fastest = route(all, a, b, { fewerChangesSlackMin: 0 })!;
    const fewer = route(all, a, b, { fewerChangesSlackMin: FEWER_CHANGES_SLACK_MIN })!;
    expect(r.minutes).toBe(fastest.minutes);
    expect(r.legs.map((l) => l.line)).toEqual(fastest.legs.map((l) => l.line));
    // The window would have swapped it for a much slower route.
    expect(fewer.transfers).toBeLessThan(fastest.transfers);
    expect(fewer.minutes).toBeGreaterThanOrEqual(fastest.minutes + 10);
  });
});

describe("route — a walk at either end doesn't dodge the window", () => {
  const all = buildGraph(allStations, allEdges);
  // Each pair is in two cities (Wakoshi has none), so the window is on. A
  // train plus a long walk used to count as "no change" and win.
  it.each([
    ["tofukuji", "kintetsu-nara"],
    ["shinjuku", "wakoshi"],
  ])("%s → %s keeps the faster route", (a, b) => {
    const r = route(all, a, b)!;
    const fastest = route(all, a, b, { fewerChangesSlackMin: 0 })!;
    expect(r.minutes).toBe(fastest.minutes);
    expect(r.legs.map((l) => l.line)).toEqual(fastest.legs.map((l) => l.line));
  });
});
