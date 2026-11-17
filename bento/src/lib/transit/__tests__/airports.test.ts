/** Every arrival airport reaches central Tokyo (ready-made trips, 1A).
 *
 *  There is no "narita-airport" or "haneda-airport" station: each airport
 *  is seeded as its terminal stations, and a Narita trip lands at the
 *  Terminal 1 station (`hubFor("narita")`). */
import { describe, expect, it } from "vitest";
import { buildGraph, route } from "../graph";
import { edges, stations } from "../seed";
import { hubFor } from "@/lib/engine/route";

const g = buildGraph(stations, edges);

describe("arrival airports", () => {
  it.each(["narita-t1", "narita-t2-t3", "haneda-t3", "haneda-t1-t2"])("%s has a route to and from Tokyo Station", (id) => {
    expect(route(g, id, "tokyo"), `${id} → tokyo`).not.toBeNull();
    expect(route(g, "tokyo", id), `tokyo → ${id}`).not.toBeNull();
  });

  it("Kansai Airport has a route to Shin-Osaka and Kyoto", () => {
    expect(route(g, "kansai-airport", "shin-osaka")).not.toBeNull();
    expect(route(g, "kansai-airport", "kyoto")).not.toBeNull();
  });

  it("a Narita trip lands at the Terminal 1 station", () => {
    expect(hubFor("narita", g)).toBe("narita-t1");
    expect(g.stations.has("narita-airport")).toBe(false);
  });

  it("reaches Ueno from Narita by the Skyliner", () => {
    const r = route(g, "narita-t1", "keisei-ueno")!;
    expect(r.legs.map((l) => l.line)).toEqual(["Keisei Skyliner"]);
  });

  it.each(["narita-t1", "narita-t2-t3"])("Narita Express from %s to Tokyo is one train with the published fare", (id) => {
    const r = route(g, id, "tokyo")!;
    expect(r.legs.map((l) => l.line)).toEqual(["JR Narita Express"]);
    expect(r.fareJpy).toBe(3140);
    expect(r.fareKind).toBe("exact");
    expect(r.unpricedRides).toBe(0);
  });
});
