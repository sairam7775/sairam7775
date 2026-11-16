import { describe, expect, it } from "vitest";
import { buildGraph, route } from "../graph";
import { edges, networks, stations } from "../seed";
import * as kanagawa from "../seed/kanagawa";
import { CITY_HUBS, hubFor } from "@/lib/engine/route";

// Kanagawa's lines start at Tokyo stations, so route over every seed.
const g = buildGraph(stations, edges);
const byId = new Map(kanagawa.stations.map((s) => [s.id, s]));

describe("Kanagawa transit seed", () => {
  it("is registered in the seed index", () => {
    expect(networks.map((n) => n.file)).toContain("kanagawa.ts");
  });

  it("shares no station id with any other seed", () => {
    const others = new Set(networks.filter((n) => n.file !== "kanagawa.ts").flatMap((n) => n.stations.map((s) => s.id)));
    expect(kanagawa.stations.filter((s) => others.has(s.id)).map((s) => s.id)).toEqual([]);
    expect(new Set(kanagawa.stations.map((s) => s.id)).size).toBe(kanagawa.stations.length);
  });

  it("places every station between Fujisawa, Enoshima, Kamakura and Shin-Yokohama", () => {
    for (const s of kanagawa.stations) {
      expect(s.lat, s.id).toBeGreaterThan(35.25);
      expect(s.lat, s.id).toBeLessThan(35.55);
      expect(s.lon, s.id).toBeGreaterThan(139.45);
      expect(s.lon, s.id).toBeLessThan(139.7);
    }
  });

  it("gives every rail ride a distance and every ride at least a minute", () => {
    for (const e of kanagawa.edges) {
      expect(e.minutes, `${e.from}→${e.to}`).toBeGreaterThanOrEqual(1);
      if (e.mode === "rail") expect(e.km, `${e.from}→${e.to}`).toBeGreaterThan(0);
    }
  });

  it("never enters a fare of ¥0", () => {
    for (const e of kanagawa.edges) if (e.fareJpy != null) expect(e.fareJpy, `${e.from}→${e.to}`).toBeGreaterThan(0);
  });

  it("reaches every Kanagawa station from Tokyo Station", () => {
    const unreachable = kanagawa.stations.filter((s) => route(g, "tokyo", s.id) == null).map((s) => s.id);
    expect(unreachable).toEqual([]);
  });

  // The stations the drafted Yokohama and Kamakura places name. A place's
  // station must be in the place's own city.
  it.each([
    ["kamakura", "kamakura"], // Tsurugaoka Hachimangu, Komachi-dori, Zeniarai Benten
    ["hase", "kamakura"], // Kotoku-in, Hase-dera
    ["jomyoji", "kamakura"], // Hokoku-ji (bus stop)
    ["kita-kamakura", "kamakura"], // Meigetsu-in, Kencho-ji, Engaku-ji, the Daibutsu hiking course
    ["enoshima", "kamakura"], // Enoshima, the Sea Candle, the aquarium (filed under Kamakura)
    ["motomachi-chukagai", "yokohama"], // Chinatown, Yamashita Park, Harbor View Park, Hikawa Maru, Motomachi, Marine Tower
    ["minatomirai", "yokohama"], // Cup Noodles Museum
    ["bashamichi", "yokohama"], // Red Brick Warehouse
    ["nihon-odori", "yokohama"], // Osanbashi
    ["shin-takashima", "yokohama"], // Hara Model Railway Museum
    ["yokohama", "yokohama"], // Hara Model Railway Museum, the other way in
    ["shin-yokohama", "yokohama"], // Shin-Yokohama Ramen Museum
    ["honmoku", "yokohama"], // Sankeien (bus stop)
  ])("has %s in %s", (id, cityId) => {
    expect(byId.get(id)?.cityId).toBe(cityId);
  });

  it("lands Yokohama and Kamakura trips at their main stations", () => {
    expect(CITY_HUBS.yokohama).toBe("yokohama");
    expect(CITY_HUBS.kamakura).toBe("kamakura");
    expect(hubFor("yokohama", g)).toBe("yokohama");
    expect(hubFor("kamakura", g)).toBe("kamakura");
  });
});

describe("route — Kanagawa", () => {
  it("Tokyo → Kamakura by JR in under an hour, never priced as free", () => {
    const r = route(g, "tokyo", "kamakura")!;
    expect(r.legs.every((l) => l.operator === "jr-east")).toBe(true);
    expect(r.minutes).toBeGreaterThanOrEqual(50);
    expect(r.minutes).toBeLessThanOrEqual(60);
    expect(r.fareJpy).toBe(0);
    expect(r.unpricedRides).toBe(1);
    // The published figures favour a change at Ofuna (54) over the direct
    // train (60); the traveller is told about the train with no change.
    if (r.transfers > 0) expect(r.legs[0].notes.join(" ")).toContain("Yokosuka Line runs there from Tokyo without a change");
  });

  it("the direct Yokosuka Line train to Kamakura is in the graph at the published 60 minutes", () => {
    const yokosuka = kanagawa.edges.filter((e) => e.line === "JR Yokosuka Line" && e.mode === "rail");
    const path = ["tokyo", "shimbashi", "shinagawa", "yokohama", "ofuna", "kita-kamakura", "kamakura"];
    let minutes = 0;
    for (let i = 1; i < path.length; i++) minutes += yokosuka.find((e) => e.from === path[i - 1] && e.to === path[i])!.minutes;
    expect(minutes).toBe(60);
  });

  it("Shinjuku → Kamakura is one Shonan-Shinjuku Line train", () => {
    const r = route(g, "shinjuku", "kamakura")!;
    expect(r.legs.map((l) => l.line)).toEqual(["JR Shonan-Shinjuku Line"]);
    expect(r.transfers).toBe(0);
    expect(r.minutes).toBe(66); // 36 to Yokohama (Visit Kanagawa) + 30 on to Kamakura
    expect(r.unpricedRides).toBe(1);
  });

  it("Shibuya → Yokohama takes the Toyoko Limited Express, faster than the Shonan-Shinjuku Line", () => {
    const r = route(g, "shibuya", "yokohama")!;
    expect(r.legs.map((l) => l.line)).toEqual(["Tokyu Toyoko Line · Limited Express"]);
    expect(r.minutes).toBe(28);
    const jr = kanagawa.edges.find((e) => e.from === "shibuya" && e.to === "yokohama" && e.line === "JR Shonan-Shinjuku Line")!;
    expect(jr.minutes).toBe(32);
  });

  it("Tokyo → Motomachi-Chukagai changes once, at Yokohama", () => {
    const r = route(g, "tokyo", "motomachi-chukagai")!;
    expect(r.transfers).toBe(1);
    expect(r.legs[0].to.id).toBe("yokohama");
    expect(r.minutes).toBeGreaterThanOrEqual(30);
    expect(r.minutes).toBeLessThanOrEqual(45);
    // The Minatomirai part is priced; the JR part is not, and is not free.
    expect(r.fareJpy).toBe(224);
    expect(r.unpricedRides).toBe(1);
  });

  it("Shibuya → Minatomirai is one through train: Toyoko Line onto the Minatomirai Line", () => {
    const r = route(g, "shibuya", "minatomirai")!;
    expect(r.legs).toHaveLength(1);
    expect(r.transfers).toBe(0);
    expect(r.legs[0].line).toBe("Tokyu Toyoko Line · Limited Express");
    expect(r.minutes).toBe(31);
    // Two companies, two fares: Tokyu has no table yet, Minatomirai is ¥193 (IC, 1.7 km).
    expect(r.fareJpy).toBe(193);
    expect(r.unpricedRides).toBe(1);
    expect(r.fareKind).toBe("estimate");
  });

  it("Shibuya → Motomachi-Chukagai takes the operator's 35 minutes", () => {
    const r = route(g, "shibuya", "motomachi-chukagai")!;
    expect(r.legs).toHaveLength(1);
    expect(r.minutes).toBe(35);
  });

  it("Kamakura → Hase is three stops on the Enoden, ¥200", () => {
    const r = route(g, "kamakura", "hase")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].operator).toBe("enoden");
    expect(r.legs[0].stops).toBe(3);
    expect(r.minutes).toBe(6);
    expect(r.fareJpy).toBe(200);
    expect(r.unpricedRides).toBe(0);
  });

  it("Kamakura → Enoshima stays on the Enoden: 9 stops, ¥260", () => {
    const r = route(g, "kamakura", "enoshima")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].stops).toBe(9);
    expect(r.minutes).toBe(24);
    expect(r.fareJpy).toBe(260);
  });

  it("Kamakura → Jomyoji is the Keikyu bus, unpriced rather than free", () => {
    const r = route(g, "kamakura", "jomyoji")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].mode).toBe("bus");
    expect(r.minutes).toBe(12);
    expect(r.fareJpy).toBe(0);
    expect(r.unpricedRides).toBe(1);
  });

  it("Yokohama → Honmoku goes by the Negishi Line and the city bus at its flat fare", () => {
    const r = route(g, "yokohama", "honmoku")!;
    expect(r.legs.map((l) => [l.mode, l.to.id])).toEqual([
      ["rail", "negishi"],
      ["bus", "honmoku"],
    ]);
    expect(r.minutes).toBe(26); // 11 on the train, a 5-minute change, 10 on the bus
    expect(r.legs[1].fareJpy).toBe(220);
    expect(r.unpricedRides).toBe(1); // the JR leg
  });

  it("Yokohama → Shin-Yokohama is the Blue Line at its exact IC fare", () => {
    const r = route(g, "yokohama", "shin-yokohama")!;
    expect(r.legs).toHaveLength(1);
    expect(r.minutes).toBe(11);
    expect(r.fareJpy).toBe(242);
    expect(r.fareKind).toBe("exact");
  });

  it("closes the loop from Enoshima to Tokyo through Fujisawa", () => {
    const r = route(g, "enoshima", "tokyo")!;
    expect(r.legs.map((l) => l.line)).toEqual(["Enoden Line", "JR Tokaido Line"]);
    expect(r.legs[0].fareJpy).toBe(220);
    expect(r.unpricedRides).toBe(1);
  });
});

describe("Kanagawa services", () => {
  // Every seeded service, its stations in order. Each must be exactly the
  // adjacent pairs of its list, both ways: a missing hop fails here.
  const services: [line: string, mode: string, stops: string[]][] = [
    ["JR Yokosuka Line", "rail", ["tokyo", "shimbashi", "shinagawa", "yokohama", "ofuna", "kita-kamakura", "kamakura"]],
    ["JR Tokaido Line", "rail", ["tokyo", "shimbashi", "shinagawa", "yokohama", "ofuna", "fujisawa"]],
    ["JR Shonan-Shinjuku Line", "rail", ["shinjuku", "shibuya", "yokohama", "ofuna", "kita-kamakura", "kamakura"]],
    ["Tokyu Toyoko Line · Limited Express", "rail", ["shibuya", "yokohama", "minatomirai", "motomachi-chukagai"]],
    ["Minatomirai Line · Local", "rail", ["yokohama", "shin-takashima", "minatomirai", "bashamichi", "nihon-odori", "motomachi-chukagai"]],
    ["JR Negishi Line", "rail", ["yokohama", "sakuragicho", "kannai", "ishikawacho", "negishi"]],
    ["Yokohama Subway Blue Line", "rail", ["yokohama", "shin-yokohama"]],
    ["Enoden Line", "rail", ["kamakura", "hase", "enoshima", "fujisawa"]],
    ["Keikyu Bus", "bus", ["kamakura", "jomyoji"]],
    ["Yokohama City Bus · 58/101", "bus", ["negishi", "honmoku"]],
  ];

  it("lists every service the seed has", () => {
    const seeded = [...new Set(kanagawa.edges.map((e) => `${e.line} / ${e.mode}`))].sort();
    expect(seeded).toEqual(services.map(([line, mode]) => `${line} / ${mode}`).sort());
  });

  it.each(services)("%s runs hop by hop, both ways", (line, mode, stops) => {
    const pairs = kanagawa.edges.filter((e) => e.line === line && e.mode === mode).map((e) => `${e.from}>${e.to}`).sort();
    const expected = stops.slice(1).flatMap((to, i) => [`${stops[i]}>${to}`, `${to}>${stops[i]}`]).sort();
    expect(pairs).toEqual(expected);
  });
});

describe("Kanagawa notes read right in each direction", () => {
  const notesOf = (from: string, to: string, line: string) =>
    kanagawa.edges.filter((e) => e.from === from && e.to === to && e.line === line).map((e) => e.note ?? "").join(" ");

  it("tells the traveller where to board the bus only on the way out", () => {
    expect(notesOf("kamakura", "jomyoji", "Keikyu Bus")).toContain("stand 4 at the East Exit");
    expect(notesOf("jomyoji", "kamakura", "Keikyu Bus")).not.toMatch(/stand|Get off at Jomyoji/);
    expect(notesOf("negishi", "honmoku", "Yokohama City Bus · 58/101")).toContain("stand 1 at Negishi Station");
    expect(notesOf("honmoku", "negishi", "Yokohama City Bus · 58/101")).not.toMatch(/stand|Get off at Honmoku/);
  });

  it("names the train for Zushi only towards Kamakura", () => {
    const line = "JR Shonan-Shinjuku Line";
    expect(notesOf("shibuya", "yokohama", line)).toContain("Zushi");
    for (const [from, to] of [["shibuya", "shinjuku"], ["yokohama", "shibuya"], ["ofuna", "yokohama"]]) {
      expect(notesOf(from, to, line), `${from}→${to}`).not.toContain("Zushi");
    }
  });

  it("keeps outbound-only directions off the return trains", () => {
    expect(notesOf("tokyo", "shimbashi", "JR Yokosuka Line")).toContain("Leaves Tokyo");
    expect(notesOf("shimbashi", "tokyo", "JR Yokosuka Line")).not.toContain("Leaves Tokyo");
    const toyoko = "Tokyu Toyoko Line · Limited Express";
    expect(notesOf("shibuya", "yokohama", toyoko)).toContain("stay on for Minatomirai");
    expect(notesOf("yokohama", "shibuya", toyoko)).not.toContain("stay on for Minatomirai");
  });
});
