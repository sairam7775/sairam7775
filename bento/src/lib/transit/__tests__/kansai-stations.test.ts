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

  it("keeps one Hiroden fare across the Kamiyacho transfer", () => {
    const r = route(g, "hatchobori", "genbaku-domu-mae")!;
    expect(r.fareJpy).toBe(240);
  });

  it("counts the stops on the new rides", () => {
    expect(route(g, "namba", "sumiyoshi-taisha")!.legs[0].stops).toBe(5);
    expect(route(g, "karasuma", "hankyu-arashiyama")!.legs[0].stops).toBe(1);
  });

  it("never prices a Randen or Hankyu ride it has no table for as free", () => {
    // Both Hankyu rides are one ticket, so one unpriced run.
    expect(route(g, "karasuma", "hankyu-arashiyama")!.unpricedRides).toBe(1);
    expect(route(g, "omuro-ninnaji", "randen-arashiyama")!.unpricedRides).toBe(1);
  });
});

describe("Kintetsu stops before Kintetsu-Nara (T-09)", () => {
  it("reaches Yamato-Saidaiji and Shin-Omiya from Osaka and Kyoto", () => {
    for (const from of ["namba", "kyoto"]) {
      for (const to of ["yamato-saidaiji", "shin-omiya"]) {
        const r = route(g, from, to);
        expect(r, `${from}→${to}`).not.toBeNull();
        expect(r!.unpricedRides).toBe(0);
        expect(r!.fareJpy).toBeGreaterThan(0);
      }
    }
  });

  it("rides one Kintetsu ticket from Namba to Shin-Omiya", () => {
    const r = route(g, "namba", "shin-omiya")!;
    expect(r.transfers).toBe(0);
    expect(r.legs.map((l) => l.to.id)).toEqual(["shin-omiya"]);
  });

  it("keeps the through train and its exact fare to Kintetsu-Nara", () => {
    const r = route(g, "namba", "kintetsu-nara")!;
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0].from.id).toBe("namba");
    expect(r.fareJpy).toBe(680);
    expect(r.fareKind).toBe("exact");
  });
});
