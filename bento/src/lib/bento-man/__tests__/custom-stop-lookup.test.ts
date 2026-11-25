/** get_place on a traveller's own stop (0036). Live, 26 Nov 2026: with
 *  "nothing in the database matches" as the only answer, Bento Man offered
 *  to look up the journey "if you have an address". Nothing in Bento turns
 *  an address into a place or a route; route_between takes a station. */
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { buildGraph } from "@/lib/transit/graph";
import { MemoryStore } from "../store.memory";
import { runTool, type ToolContext } from "../tools";
import type { DayRow, ItemRow } from "../store";

vi.mock("@/lib/transit/load", () => ({ loadGraph: async () => buildGraph([], []) }));

const row = { locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null };
const keiko: ItemRow = { ...row, placeId: "custom:dinner-at-aunt-keiko-s", customName: "Dinner at Aunt Keiko's", name: "Dinner at Aunt Keiko's", sortOrder: 2, startMin: 19 * 60, durationMin: 90 };
const day = (items: ItemRow[]): DayRow => ({ date: "2026-11-23", cityId: "kyoto-city", items: [{ ...row, placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", sortOrder: 0, startMin: 540, durationMin: 90 }, ...items] });
const store = (items: ItemRow[]) => new MemoryStore({
  trip: { title: "Kansai, autumn", startDate: "2026-11-20", endDate: "2026-11-29", partySize: 2 },
  prefs: { pace: "standard" },
  cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }],
  days: [day(items)],
});
const getPlace = async (s: MemoryStore, query: string) => {
  const ctx: ToolContext = { store: s, today: "2026-11-01", proposal: null };
  return (await runTool("get_place", { query }, ctx)).result;
};

describe("get_place on the traveller's own stop", () => {
  it("says it is their own stop, that no address can be looked up, and what can: a station", async () => {
    for (const query of ["Aunt Keiko's", "dinner at aunt keiko's", "custom:dinner-at-aunt-keiko-s"]) {
      const r = JSON.parse(await getPlace(store([keiko]), query));
      expect(r.matches, query).toEqual([]);
      expect(r.own_stop, query).toMatchObject({ name: "Dinner at Aunt Keiko's", date: "2026-11-23", time: "19:00–20:30" });
      expect(r.note).toMatch(/address/);
      expect(r.note).toMatch(/station/);
      expect(r.note).toMatch(/route_between/);
      // The traveller's words stay data, never part of the instruction.
      expect(r.note).not.toMatch(/Keiko/);
    }
  });

  it("is unchanged for a name that is nobody's stop", async () => {
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    const without = await getPlace(store([]), "Aunt Keiko's");
    expect(await getPlace(store([keiko]), "Ramen Ichiran")).toBe(without);
    expect(sha(without)).toBe(sha(JSON.stringify({ matches: [], note: "nothing in the database matches — say you don't have it rather than guessing" })));
  });
});
