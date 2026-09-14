import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gtfsToGraph, parseCsvLine } from "../gtfs";
import { buildGraph, route } from "../graph";

const dir = join(__dirname, "..", "__fixtures__", "gtfs-mini");
const read = (f: string) => readFileSync(join(dir, f), "utf8");
const files = {
  stops: read("stops.txt"), routes: read("routes.txt"), trips: read("trips.txt"),
  stop_times: read("stop_times.txt"), transfers: read("transfers.txt"),
};

describe("gtfsToGraph", () => {
  it("parses quoted CSV fields", () => {
    expect(parseCsvLine('a,"b, c","d ""e"""')).toEqual(["a", "b, c", 'd "e"']);
  });

  it("builds one edge per consecutive stop pair, keeping the fastest", () => {
    const { stations, edges } = gtfsToGraph(files);
    expect(stations.map((s) => s.id).sort()).toEqual(["K1", "K2", "S1", "S2", "S3", "S4"]);
    // Local and Rapid both run S1→S2; the Rapid's 2 min should win over 3.
    const s1s2 = edges.find((e) => e.from === "S1" && e.to === "S2")!;
    expect(s1s2.minutes).toBe(2);
    // The Rapid skips S3, so S2→S4 exists directly (10 min) alongside the
    // Local's S2→S3→S4.
    expect(edges.some((e) => e.from === "S2" && e.to === "S4")).toBe(true);
    expect(edges.some((e) => e.from === "S3" && e.to === "S4")).toBe(true);
  });

  it("turns transfers.txt into walking edges", () => {
    const { edges } = gtfsToGraph(files);
    const walk = edges.filter((e) => e.mode === "walk");
    expect(walk).toHaveLength(2);
    expect(walk[0].minutes).toBe(4);
  });

  it("prefixes ids and records which lines call at a station", () => {
    const { stations } = gtfsToGraph(files, { idPrefix: "t" });
    const s2 = stations.find((s) => s.id === "t:S2")!;
    expect(s2.lines).toEqual(["JR Nara Line"]);
  });

  it("produces a graph the router can use", () => {
    const { stations, edges } = gtfsToGraph(files);
    const g = buildGraph(stations, edges);
    const r = route(g, "S1", "K1")!;
    expect(r.legs.map((l) => l.mode)).toEqual(["rail", "walk"]);
    expect(r.minutes).toBe(2 + 4);
  });
});
