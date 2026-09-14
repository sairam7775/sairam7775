import { describe, expect, it } from "vitest";
import { buildGraph, route, placeRoute } from "../graph";
import { describeRoute } from "../describe";
import { stations, edges } from "../seed/kansai-sanyo";

const g = buildGraph(stations, edges);

describe("route — Kansai–Sanyo corridor", () => {
  it("Kyoto → Inari stays on the Local rather than changing at Tofukuji", () => {
    // The Rapid is a minute faster to Tofukuji, but changing trains there
    // costs a transfer penalty. One Local all the way must win.
    const r = route(g, "kyoto", "inari")!;
    expect(r).not.toBeNull();
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].line).toBe("JR Nara Line · Local");
    expect(r.legs[0].stops).toBe(2);
    expect(r.minutes).toBe(5);
    expect(r.transfers).toBe(0);
  });

  it("surfaces the thing a friend would tell you", () => {
    const r = route(g, "kyoto", "inari")!;
    expect(r.legs[0].notes[0]).toMatch(/Rapid does not stop at Inari/);
  });

  it("estimates a same-operator run as one banded fare, not a sum of hops", () => {
    // 1.1 km + 1.6 km on JR West = 2.7 km → the ¥150 band. Summing per-hop
    // minimums would have said ¥300, which is the mistake this guards.
    const r = route(g, "kyoto", "inari")!;
    expect(r.fareJpy).toBe(150);
    expect(r.fareKind).toBe("estimate");
  });

  it("prefers the direct Shinkansen to Hiroshima over a change at Shin-Osaka", () => {
    const r = route(g, "kyoto", "hiroshima")!;
    expect(r.legs).toHaveLength(1);
    expect(r.transfers).toBe(0);
    expect(r.minutes).toBe(100);
    expect(r.fareKind).toBe("exact");
    expect(r.fareJpy).toBe(10890);
  });

  it("walks between JR Nara and Kintetsu-Nara without a transfer penalty", () => {
    const r = route(g, "nara", "kintetsu-nara")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].mode).toBe("walk");
    expect(r.minutes).toBe(15);
    expect(r.fareJpy).toBe(0);
  });

  it("chains airport → Kyoto → Nara with exact fares summed", () => {
    const r = route(g, "kansai-airport", "kintetsu-nara")!;
    expect(r.transfers).toBeGreaterThanOrEqual(1);
    // Every paid leg here is an explicit intercity fare.
    expect(r.fareKind).toBe("exact");
    expect(r.legs.every((l) => l.mode === "walk" || l.fareJpy > 0)).toBe(true);
  });

  it("changes line at Tofukuji to reach Keihan stations, and charges for it", () => {
    const r = route(g, "kyoto", "gion-shijo")!;
    const rail = r.legs.filter((l) => l.mode !== "walk");
    expect(rail.length).toBe(2);
    expect(r.transfers).toBe(1);
    // 2 (Rapid) or 3 (Local) + 5 penalty + 6 Keihan. The Rapid wins here
    // because there is a change anyway.
    expect(r.minutes).toBe(2 + 5 + 6);
    expect(rail[1].operator).toBe("keihan");
  });

  it("adds walking time door to door", () => {
    const r = placeRoute(g, { stationId: "kyoto", walkMin: 7 }, { stationId: "inari", walkMin: 2 })!;
    expect(r.minutes).toBe(5 + 7 + 2);
  });

  it("returns null for an unknown or unreachable station", () => {
    expect(route(g, "kyoto", "nowhere")).toBeNull();
  });

  it("describes a leg the way a traveller can follow it", () => {
    const d = describeRoute(route(g, "kyoto", "inari")!);
    expect(d.summary).toBe("Kyoto → Inari · 5 min · ~¥150 · no changes");
    expect(d.lines[0]).toMatch(/^JR Nara Line · Local · Kyoto → Inari · 2 stops · 5 min · ~¥150 — Local only/);
  });

  it("marks exact fares without a tilde", () => {
    const d = describeRoute(route(g, "kyoto", "hiroshima")!);
    expect(d.summary).toContain("· ¥10,890 ·");
  });
});
