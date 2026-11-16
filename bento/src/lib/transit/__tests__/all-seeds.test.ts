import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { networks } from "../seed";
import { placeSeeds } from "@/lib/places/seed";

/** Seed files in a folder, leaving out the index and helper modules. */
const seedFiles = (folder: string, helpers: string[]) =>
  readdirSync(fileURLToPath(new URL(folder, import.meta.url)))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "index.ts" && !helpers.includes(f))
    .sort();

/** Each value that appears more than once, with how often. */
function repeats(values: string[]): string[] {
  const seen = new Map<string, number>();
  for (const v of values) seen.set(v, (seen.get(v) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([v, n]) => `${v} ×${n}`);
}

describe("every seed, together", () => {
  // A file the index leaves out is never exported and never tested.
  it("registers every transit seed file in the index", () => {
    expect(networks.map((n) => n.file).sort()).toEqual(seedFiles("../seed/", []));
  });

  it("registers every place seed file in the index", () => {
    expect(placeSeeds.map((s) => s.file).sort()).toEqual(seedFiles("../../places/seed/", ["types.ts", "to-input.ts"]));
  });

  // buildGraph keeps the last station with an id, silently; the SQL upsert
  // does the same. Two files claiming one id would lose one of them.
  it("uses each station id once across all networks", () => {
    const ids = networks.flatMap((n) => n.stations.map((s) => s.id));
    expect(repeats(ids)).toEqual([]);
  });

  it("has no edge twice for the same from, to and line", () => {
    const keys = networks.flatMap((n) => n.edges.map((e) => `${e.from} -> ${e.to} @ ${e.line}`));
    expect(repeats(keys)).toEqual([]);
  });

  it("ends every edge at a station some network has", () => {
    const ids = new Set(networks.flatMap((n) => n.stations.map((s) => s.id)));
    const loose = networks.flatMap((n) =>
      n.edges.filter((e) => !ids.has(e.from) || !ids.has(e.to)).map((e) => `${n.file}: ${e.from} -> ${e.to} (${e.line})`),
    );
    expect(loose).toEqual([]);
  });

  it("uses each place id once across all cities", () => {
    const ids = placeSeeds.flatMap((s) => s.places.map((p) => p.id));
    expect(repeats(ids)).toEqual([]);
  });

  it("points conflicts and pairs only at places that exist", () => {
    const ids = new Set(placeSeeds.flatMap((s) => s.places.map((p) => p.id)));
    const unknown = placeSeeds.flatMap((s) =>
      s.places.flatMap((p) => [...(p.conflicts ?? []), ...(p.pairs ?? [])].filter((id) => !ids.has(id)).map((id) => `${p.id} → ${id}`)),
    );
    expect(unknown).toEqual([]);
  });
});
