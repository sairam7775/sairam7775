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
    const r = route(g, "tokyo", "kamakura")!;
    expect(r.legs.length).toBeGreaterThanOrEqual(1);
    expect(r.legs.reduce((s, l) => s + l.fareJpy, 0)).toBe(1034);
  });

  it("matches the published fares at band edges", () => {
    expect(bandFare("jr-east", 1.3)).toBe(155);
    expect(bandFare("jr-east", 6.8)).toBe(209);
    expect(bandFare("jr-east", 40.9)).toBe(803); // Totsuka
    expect(bandFare("jr-east", 46.5)).toBe(902); // Ofuna
    expect(bandFare("jr-east", 63.8)).toBe(1221); // Hiratsuka
  });
});
