import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { copy } from "@/copy";
import { buildGraph } from "@/lib/transit/graph";
import { SupabaseStore } from "../store.supabase";
import { OutcomeUnknownError } from "../store";
import { buildTripView, dayCoverage } from "../trip-view";
import { planDocument } from "@/lib/trips/plan-document";
import { computeDayDiff } from "../diff";

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
  const selectCalls: [string, string][] = [];
  const from = vi.fn((table: string) => {
    const query = Object.assign(Promise.resolve({ data: structuredClone(rows[table]), error: errors[table] ?? null }), {
      select: (columns: string) => { selectCalls.push([table, columns]); return query; },
      eq: () => query, in: () => query, order: () => query, limit: () => query, range: () => query,
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
  const rpcErrors: Record<string, Error> = {};
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (rpcErrors[name]) return { error: rpcErrors[name] };
    if (name === "update_trip_dates") Object.assign(trip, args.p_patch);
    if (name === "replace_day_items") rows.itinerary_days = [{ date: args.p_date, city_id: args.p_city, itinerary_items: [] }];
    if (name === "apply_proposal") {
      rows.chat_messages = null;
      return { data: "applied", error: null };
    }
    return { error: null };
  });
  const db = { from, rpc } as unknown as SupabaseClient;
  const store = new SupabaseStore(db, "trip", "user");
  const count = (table: string) => from.mock.calls.filter(([t]) => t === table).length;
  return { store, db, rows, errors, count, selectCalls, rpc, rpcErrors };
}

describe("request-local SupabaseStore reads", () => {
  it("passes a populated base unchanged and keeps old proposals without one", async () => {
    const { store, rpc } = fixture();
    const diff = computeDayDiff([{ placeId: "a", name: "A", sortOrder: 0, startMin: 540, locked: true }], {
      date: "2026-11-21", cityId: "kyoto-city", items: [], meals: [], startMin: 540, endMin: 1020,
      budgetMin: 480, activeMin: 0, slackMin: 480, placesJpy: 0, faresJpy: 0, costJpy: 0,
      fareKind: "exact", considered: [], warnings: [],
    });
    await store.applyProposal({ summary: "Plan", days: [diff] }, "message");
    expect(diff.base).toHaveLength(1);
    expect(rpc).toHaveBeenLastCalledWith("apply_proposal", expect.objectContaining({
      p_days: [expect.objectContaining({ base: diff.base })],
    }));
    delete diff.base;
    await store.applyProposal({ summary: "Old", days: [diff] }, "message");
    expect((rpc.mock.calls.at(-1)![1].p_days as object[])[0]).not.toHaveProperty("base");
  });
  it("does not turn an RPC failure into a stale refusal", async () => {
    const { store, rpcErrors } = fixture();
    rpcErrors.apply_proposal = new Error("write failed");
    await expect(store.applyProposal({ summary: "Plan", days: [] }, "message")).rejects.toThrow("write failed");
  });
  it("takes the outcome from the RPC itself: 'applied' resolves, with no second query", async () => {
    const { store, rpc, count } = fixture();
    rpc.mockResolvedValueOnce({ data: "applied", error: null });
    await expect(store.applyProposal({ summary: "Plan", days: [] }, "message")).resolves.toBeUndefined();
    expect(count("chat_messages")).toBe(0);
  });
  it("passes an empty base to p_days and maps 'stale_day' to copy", async () => {
    const { store, rpc } = fixture();
    const diff = computeDayDiff([], {
      date: "2026-11-21", cityId: "kyoto-city", items: [], meals: [], startMin: 540, endMin: 1020,
      budgetMin: 480, activeMin: 0, slackMin: 480, placesJpy: 0, faresJpy: 0, costJpy: 0,
      fareKind: "exact", considered: [], warnings: [],
    });
    rpc.mockResolvedValueOnce({ data: "stale_day", error: null });
    await expect(store.applyProposal({ summary: "Plan", days: [diff] }, "message")).rejects.toThrow(copy.trip.proposals.staleDay);
    expect(rpc).toHaveBeenCalledWith("apply_proposal", expect.objectContaining({
      p_days: [expect.objectContaining({ base: [] })],
    }));
  });
  it("treats no value as applied: the function before 0031 returns void (null, or \"\" where void is sent as an empty string), and only once it has applied", async () => {
    for (const data of [null, undefined, ""]) {
      const { store, rpc } = fixture();
      rpc.mockResolvedValueOnce({ data: data as unknown as string, error: null });
      await expect(store.applyProposal({ summary: "Plan", days: [] }, "message"), String(data)).resolves.toBeUndefined();
    }
  });
  it("says the outcome is unknown for any other value, claiming neither success nor a stale refusal", async () => {
    expect(copy.trip.proposals.outcomeUnknown).toEqual(expect.any(String));
    for (const data of ["accepted", "Applied", "stale", 1]) {
      const { store, rpc } = fixture();
      // What a misbehaving database could send; the mock's type only knows strings.
      rpc.mockResolvedValueOnce({ data: data as string, error: null });
      await expect(store.applyProposal({ summary: "Plan", days: [] }, "message"), String(data)).rejects.toThrow(copy.trip.proposals.outcomeUnknown);
    }
  });
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

  it("loads planned map names only from places_public", async () => {
    const { store, rows, selectCalls } = fixture();
    rows.itinerary_days = [{
      date: "2026-11-21",
      city_id: "kyoto-city",
      itinerary_items: [
        { id: "item", place_id: "temple", sort_order: 0, start_time: null, duration_min: 60, locked: false },
        { id: "removed", place_id: "not-public", sort_order: 1, start_time: null, duration_min: 60, locked: false },
      ],
    }];
    rows.places_public = [{ id: "temple", name: "Temple", name_ja: "寺" }];
    const state = await store.state();
    expect(selectCalls).toContainEqual(["places_public", "id, name, name_ja"]);
    expect(state.days[0].items[0]).toMatchObject({ name: "Temple", mapName: "Temple", nameJa: "寺" });
    expect(state.days[0].items[1]).toMatchObject({ name: "not-public", mapName: null, nameJa: null });
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

describe("date proposals (#6)", () => {
  const dates = (after: { startDate: string; endDate: string }) => ({
    kind: "dates" as const,
    before: { startDate: "2026-11-20", endDate: "2026-11-23", partySize: 1, title: "Before" },
    after: { ...after, partySize: 1, title: "Before" },
    summary: "Dates",
  });

  it("previews without writing", async () => {
    const { store, db } = fixture();
    const trip = await store.previewTripDates({ startDate: "2026-11-21", endDate: "2026-11-24" });
    expect(trip).toMatchObject({ startDate: "2026-11-21", endDate: "2026-11-24" });
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("accepts dates in one call to apply_proposal_with_dates, never closing the proposal being accepted", async () => {
    const { store, db } = fixture();
    await store.applyProposal({ summary: "Dates", dates: dates({ startDate: "2026-11-21", endDate: "2026-11-24" }), days: [] }, "message");
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith("apply_proposal_with_dates", expect.objectContaining({
      p_trip: "trip",
      p_message: "message",
      p_expect_start: "2026-11-20",
      p_expect_end: "2026-11-23",
      p_patch: expect.objectContaining({ start_date: "2026-11-21", end_date: "2026-11-24" }),
      p_shift: 1,
      p_route: null,
      p_days: [],
    }));
    const args = vi.mocked(db.rpc).mock.calls[0][1] as { p_reject: string[] };
    expect(args.p_reject).not.toContain("message");
  });

  it("tells update_trip_dates which dates it read, so a second change at once is refused", async () => {
    const { store, db } = fixture();
    await store.setTripDates({ startDate: "2026-11-21", endDate: "2026-11-24" });
    expect(db.rpc).toHaveBeenCalledWith("update_trip_dates", expect.objectContaining({
      p_shift: 1,
      p_expect: { start_date: "2026-11-20", end_date: "2026-11-23" },
    }));
  });

  describe("a write that timed out may have committed", () => {
    const timedOut = () => Object.assign(new Error("AbortError: Supabase request timed out after 15000 ms"), { code: "" });

    it("accepting a proposal claims neither success nor failure", async () => {
      const { store, rpcErrors } = fixture();
      rpcErrors.apply_proposal = timedOut();
      const err = await store.applyProposal({ summary: "Plan", days: [] }, "message").catch((e) => e);
      expect(err).toBeInstanceOf(OutcomeUnknownError);
      expect(err.message).toBe(copy.trip.proposals.outcomeUnknown);
    });

    it("accepting a date proposal claims neither", async () => {
      const { store, rpcErrors } = fixture();
      rpcErrors.apply_proposal_with_dates = timedOut();
      const err = await store.applyProposal({ summary: "Dates", dates: dates({ startDate: "2026-11-21", endDate: "2026-11-24" }), days: [] }, "message").catch((e) => e);
      expect(err).toBeInstanceOf(OutcomeUnknownError);
      expect(err.message).toBe(copy.trip.proposals.outcomeUnknown);
    });

    it("changing the dates claims neither, in words for the trip's edit form", async () => {
      const { store, rpcErrors } = fixture();
      rpcErrors.update_trip_dates = timedOut();
      const err = await store.setTripDates({ startDate: "2026-11-21", endDate: "2026-11-24" }).catch((e) => e);
      expect(err).toBeInstanceOf(OutcomeUnknownError);
      expect(err.message).toBe(copy.plan.dates.outcomeUnknown);
      expect(err.message).not.toContain("AbortError");
    });

    it("leaves other write errors as they were", async () => {
      const { store, rpcErrors } = fixture();
      rpcErrors.apply_proposal = new Error("write failed");
      const err = await store.applyProposal({ summary: "Plan", days: [] }, "message").catch((e) => e);
      expect(err).not.toBeInstanceOf(OutcomeUnknownError);
      expect(err.message).toBe("write failed");
    });
  });

  it("says the dates changed meanwhile when the database refuses a stale change", async () => {
    const { store, rpcErrors } = fixture();
    rpcErrors.update_trip_dates = Object.assign(new Error("the trip dates changed meanwhile - check them and try again"), { code: "P0001" });
    const words = copy.plan.dates.changedMeanwhile;
    expect(words).toEqual(expect.any(String));
    await expect(store.setTripDates({ startDate: "2026-11-21", endDate: "2026-11-24" })).rejects.toThrow(words);
  });

  it("keeps a title or party size changed after a dates-only proposal", async () => {
    const { store, db, rows } = fixture();
    Object.assign(rows.trips as Record<string, unknown>, { title: "Renamed", party_size: 3 });
    await store.applyProposal({ summary: "Dates", dates: dates({ startDate: "2026-11-21", endDate: "2026-11-24" }), days: [] }, "message");
    const args = vi.mocked(db.rpc).mock.calls[0][1] as { p_patch: Record<string, unknown> };
    expect(args.p_patch).toMatchObject({ start_date: "2026-11-21", end_date: "2026-11-24" });
    expect(args.p_patch).not.toHaveProperty("title");
    expect(args.p_patch).not.toHaveProperty("party_size");
  });

  it("applies a party size the proposal itself changed", async () => {
    const { store, db } = fixture();
    const grown = { ...dates({ startDate: "2026-11-21", endDate: "2026-11-24" }) };
    grown.after = { ...grown.after, partySize: 2 };
    await store.applyProposal({ summary: "Dates", dates: grown, days: [] }, "message");
    const args = vi.mocked(db.rpc).mock.calls[0][1] as { p_patch: Record<string, unknown> };
    expect(args.p_patch).toMatchObject({ party_size: 2 });
    expect(args.p_patch).not.toHaveProperty("title");
  });

  it("refuses when the trip moved since the proposal", async () => {
    const { store, db } = fixture();
    const moved = { ...dates({ startDate: "2026-11-21", endDate: "2026-11-24" }), before: { startDate: "2026-11-01", endDate: "2026-11-04", partySize: 1, title: "Before" } };
    await expect(store.applyProposal({ summary: "Dates", dates: moved, days: [] }, "message")).rejects.toThrow(/changed while this was open/);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("saves the permission only through setAutoApplyDates", async () => {
    const { store, rows } = fixture();
    await store.savePreferences({ pace: "relaxed" });
    expect(rows.user_preferences).not.toHaveProperty("apply_dates_without_asking");
    await store.setAutoApplyDates(true);
    expect(rows.user_preferences).toMatchObject({ user_id: "user", apply_dates_without_asking: true });
  });
});

describe("place backgrounds", () => {
  const B = "Built in 1397 as a retirement villa for the shogun Ashikaga Yoshimitsu, it became a Zen temple after his death. A monk burned it down in 1950; what stands now is the 1955 rebuild.";

  it("reads a checked background through the public view", async () => {
    const { store, rows, selectCalls } = fixture();
    rows.place_backgrounds_public = [{ place_id: "kyt-kinkakuji", body: B, sources: ["shokoku-ji.jp"] }];
    expect((await store.background("kyt-kinkakuji"))?.body).toBe(B);
    expect(selectCalls.some(([t]) => t === "place_backgrounds_public")).toBe(true);
  });

  it("has no background for a place without a checked one", async () => {
    const { store } = fixture();
    expect(await store.background("kyt-kiyomizu")).toBeNull();
  });

  it("counts an ask and never throws when counting fails", async () => {
    const { store, rpc, rpcErrors } = fixture();
    await store.noteBackgroundAsk("kyt-kinkakuji");
    expect(rpc).toHaveBeenCalledWith("note_background_ask", { p_place_id: "kyt-kinkakuji" });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    rpcErrors.note_background_ask = new Error("violates foreign key constraint");
    await expect(store.noteBackgroundAsk("nope")).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

// A saved day's name and coverage come from its own city, read with the day
// (itinerary_days joined to cities), so a day trip off the route is covered
// as that city. MemoryStore fills the same field by hand; these pin the join.
describe("a saved day's own city", () => {
  const route = [{ city_id: "hiroshima-city", nights: 3, sort_order: 0, budget_band: null, reason: null, arrive_date: "2026-11-20", depart_date: "2026-11-23", cities: { name: "Hiroshima", coverage_tier: "deep" } }];
  const stop = (id: string) => ({ id: `i-${id}`, place_id: id, sort_order: 0, start_time: "09:00:00", duration_min: 60, locked: false, reason: null, reason_terms: [], arrive_mode: null, arrive_minutes: null, arrive_detail: null });
  const days = [
    { id: "d1", date: "2026-11-20", city_id: "hiroshima-city", cities: { name: "Hiroshima", coverage_tier: "deep" }, itinerary_items: [stop("hir-peace-park")] },
    { id: "d2", date: "2026-11-21", city_id: "miyajima", cities: { name: "Miyajima", coverage_tier: "outline" }, itinerary_items: [stop("miy-itsukushima")] },
    // Some clients give a to-one join as a one-row list.
    { id: "d3", date: "2026-11-22", city_id: "miyajima", cities: [{ name: "Miyajima", coverage_tier: "outline" }], itinerary_items: [] },
    { id: "d4", date: "2026-11-23", city_id: null, cities: null, itinerary_items: [] },
  ];
  const loaded = () => {
    const f = fixture();
    f.rows.trip_cities = route;
    f.rows.itinerary_days = structuredClone(days);
    return f;
  };

  it("asks for each day's city with the day", async () => {
    const { store, selectCalls } = loaded();
    await store.state();
    const select = selectCalls.find(([t]) => t === "itinerary_days")![1];
    expect(select).toContain("cities(name, coverage_tier)");
  });

  it("fills the day's city on and off the route, and leaves it empty without one", async () => {
    const { store } = loaded();
    const state = await store.state();
    expect(state.days.map((d) => d.city)).toEqual([
      { name: "Hiroshima", tier: "deep" },
      { name: "Miyajima", tier: "outline" },
      { name: "Miyajima", tier: "outline" },
      null,
    ]);
  });

  it("a day whose city didn't come back falls back to the route, then to not covered", async () => {
    const { store, rows } = loaded();
    rows.itinerary_days = [
      { id: "d1", date: "2026-11-20", city_id: "hiroshima-city", cities: null, itinerary_items: [] },
      { id: "d2", date: "2026-11-21", city_id: "miyajima", cities: null, itinerary_items: [] },
    ];
    const view = buildTripView(await store.state(), null);
    expect(view.dayList.slice(0, 2).map(([, m]) => [m.cityName, m.tier])).toEqual([["Hiroshima", "deep"], ["miyajima", "stub"]]);
  });

  it("carries an off-route main-sights day through the view and the download", async () => {
    const { store } = loaded();
    const state = await store.state();
    const view = buildTripView(state, "2026-11-21");
    expect(view.selectedMeta).toEqual({ cityId: "miyajima", cityName: "Miyajima", tier: "outline" });
    expect(dayCoverage(view.selectedMeta!, view.selectedDay!.items.length)).toMatchObject({ words: copy.coverage.outline, editable: true, mainSights: true });
    const doc = planDocument(state, view.dayList, [], new Map(), new Map());
    expect(doc.days.map((d) => [d.city, d.mainSights])).toEqual([["Hiroshima", false], ["Miyajima", true], ["Miyajima", false], ["—", false]]);
  });
});

describe("SupabaseStore reference reads past the API's row limit", () => {
  /** Answers like PostgREST: at most `cap` rows a response, and a count only
   *  when the query asks for `{ count: "exact" }`. */
  function capped(tables: Record<string, Record<string, unknown>[]>, cap = 1000) {
    const from = vi.fn((table: string) => {
      const filters: [string, unknown][] = [];
      let count: string | undefined;
      const query = {
        select: (_columns?: string, o?: { count?: string }) => ((count = o?.count), query),
        eq: (column: string, value: unknown) => (filters.push([column, value]), query),
        order: () => query,
        range: async (a: number, b: number) => {
          const rows = (tables[table] ?? []).filter((r) => filters.every(([c, v]) => r[c] === v));
          return { data: rows.slice(a, Math.min(b + 1, a + cap)), error: null, count: count === "exact" ? rows.length : null };
        },
      };
      return query;
    });
    return new SupabaseStore({ from } as unknown as SupabaseClient, "trip", "user");
  }

  it("reads everything when the server's limit is lower than a page", async () => {
    const store = capped(
      {
        city_coverage: Array.from({ length: 650 }, (_, i) => ({ city_id: `city-${String(i).padStart(4, "0")}`, name: `City ${i}`, coverage_tier: "deep", verified_places: 0 })),
        places_public: Array.from({ length: 610 }, (_, i) => ({ id: `p-${String(i).padStart(4, "0")}`, city_id: "city-0001", name: `Place ${i}` })),
      },
      300,
    );

    expect((await store.cities()).length).toBe(650);
    expect((await store.places("city-0001")).length).toBe(610);
  });

  it("reads every city and every place in a city", async () => {
    const store = capped({
      city_coverage: Array.from({ length: 1200 }, (_, i) => ({ city_id: `city-${String(i).padStart(4, "0")}`, name: `City ${i}`, coverage_tier: "deep", verified_places: 0 })),
      places_public: Array.from({ length: 1005 }, (_, i) => ({ id: `p-${String(i).padStart(4, "0")}`, city_id: "city-0001", name: `Place ${i}` })),
    });

    expect((await store.cities()).length).toBe(1200);
    expect((await store.places("city-0001")).length).toBe(1005);
  });
});
