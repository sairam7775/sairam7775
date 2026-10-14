import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildGraph } from "@/lib/transit/graph";
import { SupabaseStore } from "../store.supabase";

vi.mock("@/lib/transit/load", () => ({ loadGraph: async () => buildGraph([], []) }));

/** Only the query surface used here; no database or live project. */
function fixture() {
  const trip = { id: "trip", title: "Before", start_date: "2026-11-20", end_date: "2026-11-23", party_size: 1, status: "planning" };
  const rows: Record<string, unknown> = {
    trips: trip, user_preferences: null, trip_cities: [], itinerary_days: [], chat_messages: null,
    city_coverage: [{ city_id: "kyoto-city", name: "Kyoto", coverage_tier: "deep", verified_places: 25 }],
    places_public: [],
  };
  const errors: Record<string, Error | null> = {};
  const from = vi.fn((table: string) => {
    const query = Object.assign(Promise.resolve({ data: structuredClone(rows[table]), error: errors[table] ?? null }), {
      select: () => query, eq: () => query, order: () => query, limit: () => query,
      maybeSingle: () => query, single: () => query,
      upsert: async (row: Record<string, unknown>) => {
        rows[table] = row;
        return { error: null };
      },
      insert: (row: Record<string, unknown>) => {
        if (row.proposed_diff) rows.chat_messages = { id: "message", proposed_diff: row.proposed_diff };
        return { select: () => ({ single: async () => ({ data: { id: "message" }, error: null }) }) };
      },
    });
    return query;
  });
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "update_trip_dates") Object.assign(trip, args.p_patch);
    if (name === "replace_day_items") rows.itinerary_days = [{ date: args.p_date, city_id: args.p_city, itinerary_items: [] }];
    if (name === "apply_proposal") rows.chat_messages = null;
    return { error: null };
  });
  const db = { from, rpc } as unknown as SupabaseClient;
  const store = new SupabaseStore(db, "trip", "user");
  const count = (table: string) => from.mock.calls.filter(([t]) => t === table).length;
  return { store, db, rows, errors, count };
}

describe("request-local SupabaseStore reads", () => {
  it("shares concurrent and sequential state/city reads and keeps stores isolated", async () => {
    const { store, db, count } = fixture();
    const [first, second] = await Promise.all([store.state(), store.state()]);
    expect(first).toBe(second);
    expect(await store.state()).toBe(first);
    const [cities, sameCities] = await Promise.all([store.cities(), store.cities()]);
    expect(cities).toBe(sameCities);
    expect(await store.cities()).toBe(cities);
    for (const table of ["trips", "user_preferences", "trip_cities", "itinerary_days", "chat_messages", "city_coverage"]) expect(count(table)).toBe(1);
    await new SupabaseStore(db, "trip", "other-user").state();
    expect(count("trips")).toBe(2);
  });

  it("shares city coverage when concurrent place reads need tiers", async () => {
    const { store, count } = fixture();
    await Promise.all([store.places("kyoto-city"), store.places("osaka-city"), store.cities()]);
    expect(count("city_coverage")).toBe(1);
  });

  it("retries failed reads", async () => {
    const { store, errors, count } = fixture();
    errors.trips = new Error("read failed");
    await expect(store.state()).rejects.toThrow("read failed");
    errors.trips = null;
    expect((await store.state()).trip.title).toBe("Before");
    expect(count("trips")).toBe(2);
    errors.city_coverage = new Error("coverage failed");
    await expect(store.cities()).rejects.toThrow("coverage failed");
    errors.city_coverage = null;
    expect(await store.cities()).toHaveLength(1);
    expect(count("city_coverage")).toBe(2);
  });

  it("refreshes preferences and trip metadata after writes, then shares the fresh read", async () => {
    const { store, count } = fixture();
    await store.state();
    expect((await store.savePreferences({ pace: "packed" })).pace).toBe("packed");
    expect((await store.state()).prefs.pace).toBe("packed");
    expect(count("trips")).toBe(2);
    expect((await store.setTripDates({ title: "After" })).title).toBe("After");
    expect((await store.state()).trip.title).toBe("After");
    expect(count("trips")).toBe(3);
  });

  it("refreshes saved days and pending proposals but shares state after plain messages", async () => {
    const { store, count } = fixture();
    await store.state();
    await store.append("user", "Hello");
    await store.state();
    expect(count("trips")).toBe(1);
    await store.saveDay({ date: "2026-11-21", cityId: "kyoto-city", items: [] });
    expect((await store.state()).days).toMatchObject([{ date: "2026-11-21", cityId: "kyoto-city" }]);
    const proposal = { summary: "New proposal", days: [] };
    await store.append("assistant", "Proposal", proposal);
    expect((await store.state()).pendingProposal).toEqual({ id: "message", summary: "New proposal" });
    await store.applyProposal(proposal, "message");
    expect((await store.state()).pendingProposal).toBeNull();
    expect(count("trips")).toBe(4);
  });
});
