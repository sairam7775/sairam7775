/** The day box's "what's off" lines read as little as they can (review #13):
 *  only the selected day's places, through places_public, and no bookings
 *  (the page already has them). */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { copy } from "@/copy";
import { DEFAULT_PREFS, type TripState } from "@/lib/bento-man/store";
import { kyoto } from "@/lib/engine/__fixtures__/kyoto";
import { savedStopWarnings, stopWarningPlaces } from "../stop-warnings";

const item = (placeId: string, startMin: number, sortOrder: number) => ({ placeId, name: placeId, sortOrder, startMin, durationMin: 60, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null });
const state: TripState = {
  trip: { id: "t", title: null, startDate: "2026-11-20", endDate: "2026-11-25", partySize: 1, status: "planning" },
  prefs: DEFAULT_PREFS,
  cities: [],
  // Monday 23 November.
  days: [{ date: "2026-11-23", cityId: "kyoto-city", city: { name: "Kyoto", tier: "deep" }, items: [item("kyt-national-museum", 600, 0), item("custom:ramen", 720, 1)] }],
  pendingProposal: null,
};

function stubDb(rows: unknown[]) {
  const calls: { table: string; columns: string; ids?: string[] }[] = [];
  const from = vi.fn((table: string) => {
    const call: { table: string; columns: string; ids?: string[] } = { table, columns: "" };
    calls.push(call);
    const q = Object.assign(Promise.resolve({ data: rows, error: null }), {
      select: (c: string) => { call.columns = c; return q; },
      in: (_: string, ids: string[]) => { call.ids = ids; return q; },
    });
    return q;
  });
  return { db: { from } as unknown as SupabaseClient, calls };
}

describe("stopWarningPlaces", () => {
  it("reads only the day's Bento places, through places_public", async () => {
    const museum = kyoto.find((p) => p.id === "kyt-national-museum")!;
    const { db, calls } = stubDb([{ id: museum.id, city_id: "kyoto-city", name: museum.name, verification_status: "verified" }]);
    const places = await stopWarningPlaces(db, state, "2026-11-23");
    expect(calls).toHaveLength(1);
    expect(calls[0].table).toBe("places_public");
    expect(calls[0].ids).toEqual(["kyt-national-museum"]);
    expect([...places.keys()]).toEqual(["kyt-national-museum"]);
  });

  it("reads nothing for a day with no Bento stops", async () => {
    const { db, calls } = stubDb([]);
    await stopWarningPlaces(db, { ...state, days: [{ ...state.days[0], items: [item("custom:ramen", 720, 0)] }] }, "2026-11-23");
    expect(calls).toHaveLength(0);
  });
});

describe("savedStopWarnings", () => {
  it("says what's off, from the bookings the page already has", () => {
    const places = new Map(kyoto.map((p) => [p.id, p]));
    const w = savedStopWarnings({ state, date: "2026-11-23", places, bookings: [] });
    expect(w.get("kyt-national-museum")).toEqual([copy.plan.leftOut.closed("Monday")]);
    expect(w.has("custom:ramen")).toBe(false);
  });
});
