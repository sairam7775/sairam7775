/** A leg's fare is the whole fare or nothing: a part of it must never read
 *  as the price of the journey. */
import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { edges, stations } from "@/lib/transit/seed";
import { assessRoute, type CityFacts } from "../route";

const graph = buildGraph(stations, edges);
const city = (id: string, hubStation: string | null = null): [string, CityFacts] =>
  [id, { id, name: id, tier: "deep", verifiedPlaces: 30, transitNote: null, hubStation }];
const facts = new Map<string, CityFacts>([city("tokyo-city"), city("kamakura"), city("haneda", "haneda-t3")]);

describe("assessRoute fares", () => {
  it("leaves a leg's fare unknown when any ride on it has no fare", () => {
    // Haneda T3 → Tokyo: the monorail (unpriced) then JR (¥199).
    const a = assessRoute([{ cityId: "haneda", nights: 1 }, { cityId: "tokyo-city", nights: 2 }], facts, graph, 3);
    expect(a.legs).toHaveLength(1);
    expect(a.legs[0].minutes).not.toBeNull();
    expect(a.legs[0].fareJpy).toBeNull();
    expect(a.legs[0].summary).toContain("fare not in Bento yet");
  });

  it("keeps the fare of a leg Bento can price whole", () => {
    const a = assessRoute([{ cityId: "tokyo-city", nights: 2 }, { cityId: "kamakura", nights: 1 }], facts, graph, 3);
    expect(a.legs[0].fareJpy).toBe(1034);
    expect(a.legs[0].fareKind).toBe("estimate");
  });
});
