import { describe, expect, it } from "vitest";
import { buildGraph, route } from "../graph";
import * as kansai from "../seed/kansai-sanyo";

const g = buildGraph(kansai.stations, kansai.edges);

describe("stations added for the review notes (T-07)", () => {
  it("reaches each new station from its city's main station", () => {
    for (const [from, to] of [
      ["kyoto", "omuro-ninnaji"], ["kyoto", "hankyu-arashiyama"], ["kyoto", "randen-arashiyama"],
      ["namba", "sumiyoshi-taisha"], ["hiroshima", "kamiyacho-higashi"],
    ]) {
      expect(route(g, from, to), `${from}→${to}`).not.toBeNull();
    }
  });

  it("changes at Katsura for Hankyu Arashiyama", () => {
    const r = route(g, "karasuma", "hankyu-arashiyama")!;
    expect(r.legs.map((l) => l.line)).toEqual(["Hankyu Kyoto Line · Limited Express", "Hankyu Arashiyama Line"]);
    expect(r.transfers).toBe(1);
  });

  it("changes at Katabiranotsuji between the two Randen lines", () => {
    const r = route(g, "omuro-ninnaji", "randen-arashiyama")!;
    expect(r.legs.map((l) => l.line)).toEqual(["Randen Kitano Line", "Randen Arashiyama Line"]);
    expect(r.legs[0].to.id).toBe("katabiranotsuji");
  });

  it("prices Namba → Sumiyoshi-taisha from Nankai's distance bands", () => {
    const r = route(g, "namba", "sumiyoshi-taisha")!;
    expect(r.legs).toHaveLength(1);
    expect(r.fareJpy).toBeGreaterThan(0);
    expect(r.unpricedRides).toBe(0);
  });

  it("never prices a Randen or Hankyu ride it has no table for as free", () => {
    // Both Hankyu rides are one ticket, so one unpriced run.
    expect(route(g, "karasuma", "hankyu-arashiyama")!.unpricedRides).toBe(1);
    expect(route(g, "omuro-ninnaji", "randen-arashiyama")!.unpricedRides).toBe(1);
  });
});
