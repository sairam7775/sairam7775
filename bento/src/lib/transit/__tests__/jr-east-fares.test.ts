/** JR East rides are priced from its trunk-line (幹線) IC fare table, as
 *  revised on 14 March 2026. Expected figures are published IC fares from
 *  Tokyo Station (see fares.ts for the sources). */
import { describe, expect, it } from "vitest";
import { buildGraph, route } from "../graph";
import { bandFare } from "../fares";
import { edges, stations } from "../seed";

const g = buildGraph(stations, edges);

describe("JR East fares", () => {
  it.each([
    ["yokohama", 528],
    ["kamakura", 1034],
    ["shinagawa", 209],
    ["shinjuku", 253],
  ])("Tokyo → %s is one JR ticket at ¥%i", (to, fare) => {
    const r = route(g, "tokyo", to as string)!;
    expect(r.legs.every((l) => l.operator === "jr-east")).toBe(true);
    expect(r.unpricedRides).toBe(0);
    expect(r.fareJpy).toBe(fare);
    expect(r.fareKind).toBe("estimate");
  });

  it("a change of JR line on the way is still one ticket: Tokyo → Kamakura via Ofuna", () => {
    // The fastest route changes at Ofuna; the default takes the direct train.
    const r = route(g, "tokyo", "kamakura", { fewerChangesSlackMin: 0 })!;
    expect(r.legs.map((l) => [l.line, l.to.id])).toEqual([
      ["JR Tokaido Line", "ofuna"],
      ["JR Shonan-Shinjuku Line", "kamakura"],
    ]);
    // One band for the 51.0 km ridden, charged once on the first leg; the
    // two legs priced alone would be ¥902 + ¥155.
    expect(r.legs.map((l) => l.fareJpy)).toEqual([1034, 0]);
    expect(r.fareJpy).toBe(1034);
    expect(r.fareJpy).not.toBe(bandFare("jr-east", 46.5)! + bandFare("jr-east", 4.5)!);
  });

  it("leaves a JR ride past the end of the table unpriced, not charged the last band", () => {
    expect(bandFare("jr-east", 100)).toBe(1782);
    expect(bandFare("jr-east", 100.1)).toBeNull();
    expect(bandFare("jr-east", 476.3)).toBeNull();
  });

  it("matches the published fares at band edges", () => {
    expect(bandFare("jr-east", 1.3)).toBe(155);
    expect(bandFare("jr-east", 6.8)).toBe(209);
    expect(bandFare("jr-east", 40.9)).toBe(803); // Totsuka
    expect(bandFare("jr-east", 46.5)).toBe(902); // Ofuna
    expect(bandFare("jr-east", 63.8)).toBe(1221); // Hiratsuka
  });
});
