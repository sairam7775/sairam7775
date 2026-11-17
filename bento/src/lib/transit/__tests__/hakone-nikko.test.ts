import { describe, expect, it } from "vitest";
import { buildGraph, route } from "../graph";
import { edges, networks, stations } from "../seed";
import * as hakone from "../seed/hakone";
import * as nikko from "../seed/nikko";
import { CITY_HUBS, hubFor } from "@/lib/engine/route";

// Both networks start at Tokyo stations, so route over every seed.
const g = buildGraph(stations, edges);

describe.each([
  ["hakone.ts", hakone, { lat: [35.15, 35.7], lon: [138.95, 139.8] }],
  ["nikko.ts", nikko, { lat: [36.5, 36.8], lon: [139.4, 139.95] }],
] as const)("%s", (file, net, box) => {
  it("is registered in the seed index", () => {
    expect(networks.map((n) => n.file)).toContain(file);
  });

  it("shares no station id with any other seed", () => {
    const others = new Set(networks.filter((n) => n.file !== file).flatMap((n) => n.stations.map((s) => s.id)));
    expect(net.stations.filter((s) => others.has(s.id)).map((s) => s.id)).toEqual([]);
  });

  it("places every station inside its area", () => {
    for (const s of net.stations) {
      expect(s.lat, s.id).toBeGreaterThan(box.lat[0]);
      expect(s.lat, s.id).toBeLessThan(box.lat[1]);
      expect(s.lon, s.id).toBeGreaterThan(box.lon[0]);
      expect(s.lon, s.id).toBeLessThan(box.lon[1]);
    }
  });

  it("gives every rail ride a distance, every ride a minute, and no fare of ¥0", () => {
    for (const e of net.edges) {
      expect(e.minutes, `${e.from}→${e.to}`).toBeGreaterThanOrEqual(1);
      if (e.mode === "rail") expect(e.km, `${e.from}→${e.to}`).toBeGreaterThan(0);
      if (e.fareJpy != null) expect(e.fareJpy, `${e.from}→${e.to}`).toBeGreaterThan(0);
    }
  });

  it("reaches every station from Tokyo Station, and Tokyo Station from every station", () => {
    expect(net.stations.filter((s) => route(g, "tokyo", s.id) == null).map((s) => s.id)).toEqual([]);
    expect(net.stations.filter((s) => route(g, s.id, "tokyo") == null).map((s) => s.id)).toEqual([]);
  });
});

describe("Hakone and Nikko stations", () => {
  const byId = new Map([...hakone.stations, ...nikko.stations].map((s) => [s.id, s]));

  // The stations the drafted places name. A place's station must be in the
  // place's own city.
  it.each([
    ["hakone-yumoto", "hakone"],
    ["chokoku-no-mori", "hakone"],
    ["gora", "hakone"],
    ["owakudani", "hakone"],
    ["togendai", "hakone"],
    ["hakone-machi-ko", "hakone"],
    ["moto-hakone-ko", "hakone"],
    ["tobu-nikko", "nikko"],
    ["jr-nikko", "nikko"],
    ["shinkyo", "nikko"],
    ["tamozawa", "nikko"],
    ["chuzenji-onsen", "nikko"],
    ["ryuzu-no-taki", "nikko"],
  ])("has %s in %s", (id, cityId) => {
    expect(byId.get(id)?.cityId).toBe(cityId);
  });

  it("keeps Odawara and Utsunomiya outside Bento's cities", () => {
    expect(byId.get("odawara")?.cityId).toBeNull();
    expect(byId.get("utsunomiya")?.cityId).toBeNull();
  });

  it("lands Hakone trips at Hakone-Yumoto and Nikko trips at Tobu-Nikko", () => {
    expect(CITY_HUBS.hakone).toBe("hakone-yumoto");
    expect(CITY_HUBS.nikko).toBe("tobu-nikko");
    expect(hubFor("hakone", g)).toBe("hakone-yumoto");
    expect(hubFor("nikko", g)).toBe("tobu-nikko");
  });
});

describe("route — Hakone", () => {
  it("Tokyo → Hakone-Yumoto: the Shinkansen to Odawara, then the Tozan line, under an hour", () => {
    const r = route(g, "tokyo", "hakone-yumoto")!;
    expect(r.legs.map((l) => [l.line, l.to.id])).toEqual([
      ["Tokaido Shinkansen · Kodama", "odawara"],
      ["Hakone Tozan Line · Local", "hakone-yumoto"],
    ]);
    expect(r.minutes).toBe(53); // 33 + a 5-minute change + 15
    // JR Central has no fare table: unpriced, never free. The Tozan ride is exact.
    expect(r.legs[1].fareJpy).toBe(360);
    expect(r.unpricedRides).toBe(1);
  });

  it("Shinjuku → Hakone-Yumoto takes no longer than the Romancecar's 85 minutes", () => {
    const r = route(g, "shinjuku", "hakone-yumoto")!;
    expect(r.minutes).toBeGreaterThanOrEqual(50);
    expect(r.minutes).toBeLessThanOrEqual(85);
  });

  it("the Romancecar runs Shinjuku → Hakone-Yumoto without a change, at its published fare", () => {
    const rc = hakone.edges.find((e) => e.from === "shinjuku" && e.to === "hakone-yumoto")!;
    expect(rc.line).toBe("Odakyu Romancecar");
    expect(rc.minutes).toBe(85);
    expect(rc.fareJpy).toBe(2470);
    const back = hakone.edges.find((e) => e.from === "hakone-yumoto" && e.to === "shinjuku")!;
    expect(back.fareJpy).toBe(2470);
  });

  it("Hakone-Yumoto → Gora is the mountain train: 40 minutes, ¥460", () => {
    const r = route(g, "hakone-yumoto", "gora")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].stops).toBe(6);
    expect(r.minutes).toBe(40);
    expect(r.fareJpy).toBe(460);
  });

  it("Chokoku-no-Mori → Gora is the short ride, ¥160", () => {
    expect(route(g, "chokoku-no-mori", "gora")!.fareJpy).toBe(160);
  });

  it("Gora → Togendai: cable car, then both ropeway sections with one change at Owakudani and one ropeway fare", () => {
    const r = route(g, "gora", "togendai")!;
    expect(r.legs.map((l) => l.to.id)).toEqual(["sounzan", "owakudani", "togendai"]);
    expect(r.transfers).toBe(2);
    expect(r.minutes).toBe(50); // 10 + 5 + 10 + 5 + 20
    expect(r.fareJpy).toBe(430 + 2000);
    expect(r.unpricedRides).toBe(0);
  });

  it("Tokyo → Togendai is reachable in under three hours", () => {
    const r = route(g, "tokyo", "togendai")!;
    expect(r.minutes).toBeGreaterThanOrEqual(120);
    expect(r.minutes).toBeLessThanOrEqual(170);
  });

  it("Togendai → Moto-Hakone stays on the ship through Hakone-machi, one ¥1,700 fare", () => {
    const r = route(g, "togendai", "moto-hakone-ko")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].mode).toBe("ferry");
    expect(r.minutes).toBe(40);
    expect(r.fareJpy).toBe(1700);
    expect(r.fareKind).toBe("exact");
  });

  it("Hakone-machi → Togendai is ¥1,700 too, by way of Moto-Hakone", () => {
    const r = route(g, "hakone-machi-ko", "togendai")!;
    expect(r.legs).toHaveLength(1);
    expect(r.minutes).toBe(35);
    expect(r.fareJpy).toBe(1700);
  });

  it("Hakone-machi → Moto-Hakone is the ¥600 short crossing", () => {
    const r = route(g, "hakone-machi-ko", "moto-hakone-ko")!;
    expect(r.minutes).toBe(10);
    expect(r.fareJpy).toBe(600);
  });

  it("Moto-Hakone → Hakone-Yumoto is the Tozan bus at its fare", () => {
    const r = route(g, "moto-hakone-ko", "hakone-yumoto")!;
    expect(r.legs.map((l) => l.mode)).toEqual(["bus"]);
    expect(r.minutes).toBe(35);
    expect(r.fareJpy).toBe(1210);
  });
});

describe("route — Nikko", () => {
  it("Tokyo → Tobu-Nikko: the Tohoku Shinkansen and the JR Nikko Line, then a short walk", () => {
    const r = route(g, "tokyo", "tobu-nikko")!;
    expect(r.legs.map((l) => l.to.id)).toEqual(["utsunomiya", "jr-nikko", "tobu-nikko"]);
    expect(r.minutes).toBe(105); // 47 + 5 + 45 + 8
    expect(r.unpricedRides).toBe(1); // one JR East run past the band table's 100 km
    expect(r.fareJpy).toBe(0);
  });

  it("Utsunomiya → Nikko alone is within JR East's band table", () => {
    const r = route(g, "utsunomiya", "jr-nikko")!;
    expect(r.legs.map((l) => l.line)).toEqual(["JR Nikko Line"]);
    expect(r.fareJpy).toBe(803); // 40.5 km
    expect(r.unpricedRides).toBe(0);
  });

  it("has no one-stop Shinkansen hop between Tokyo and Ueno", () => {
    const hop = nikko.edges.filter((e) => [e.from, e.to].includes("ueno") && [e.from, e.to].includes("tokyo"));
    expect(hop).toEqual([]);
  });

  it("Asakusa → Tobu-Nikko takes no longer than the Tobu limited express's two hours", () => {
    const r = route(g, "asakusa", "tobu-nikko")!;
    expect(r.minutes).toBeGreaterThanOrEqual(90);
    expect(r.minutes).toBeLessThanOrEqual(120);
  });

  it("the Tobu limited express runs Asakusa → Tobu-Nikko without a change, unpriced", () => {
    const tobu = nikko.edges.find((e) => e.from === "asakusa" && e.to === "tobu-nikko")!;
    expect(tobu.line).toBe("Tobu Limited Express · Kegon");
    expect(tobu.minutes).toBe(120);
    expect(tobu.fareJpy ?? null).toBeNull();
    expect(tobu.note).toContain("limited express ticket");
  });

  it("Tobu-Nikko → Chuzenji Onsen (Kegon Falls) is the 50-minute bus, unpriced rather than free", () => {
    const r = route(g, "tobu-nikko", "chuzenji-onsen")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].mode).toBe("bus");
    expect(r.minutes).toBe(50);
    expect(r.fareJpy).toBe(0);
    expect(r.unpricedRides).toBe(1);
  });

  it("Tobu-Nikko → Ryuzu Falls stays on a bus for Yumoto Onsen, about an hour", () => {
    const r = route(g, "tobu-nikko", "ryuzu-no-taki")!;
    expect(r.legs).toHaveLength(1);
    expect(r.minutes).toBe(60);
    expect(r.legs[0].notes.join(" ")).toContain("Yumoto Onsen");
  });
});
