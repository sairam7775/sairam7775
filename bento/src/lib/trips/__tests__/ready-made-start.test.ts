import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MemoryStore } from "@/lib/bento-man/store.memory";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { ProposalSchema, type Proposal } from "@/lib/bento-man/diff";
import type { TripMeta } from "@/lib/bento-man/store";
import type { CoverageTier } from "@/lib/types";
import { copy } from "@/copy";
import { readyMadeTrips, type ReadyMadeTrip } from "../ready-made";
import { availableReadyMade, parseReadyMadeStart, startReadyMade, tokyoToday, TRIP_CAP, type ReadyMadeStartDeps } from "../ready-made/start";

/** 19 Nov 2026, 09:30 in Tokyo. */
const NOW = new Date("2026-11-19T00:30:00Z");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

const tripById = (id: string): ReadyMadeTrip => readyMadeTrips.find((t) => t.id === id)!;
const e = copy.readyMade.picker.errors;

/** The live tiers on 19 Nov 2026: four cities planned, five still stub. */
const LIVE: Record<string, CoverageTier> = {
  "kyoto-city": "deep",
  "osaka-city": "deep",
  "nara-city": "deep",
  "hiroshima-city": "deep",
  "tokyo-city": "stub",
  miyajima: "stub",
  himeji: "stub",
  kamakura: "stub",
  yokohama: "stub",
};

/** A catalogue and a trip factory over the memory store, recording what was
 *  created and what was thrown away. */
/** The Supabase store's own append and apply, over a client that answers
 *  only what they ask: the message insert, the trip's dates and the
 *  apply_proposal call, which returns `outcome`. So the proposal passes
 *  ProposalSchema on the way in, and the outcome is read as in the product. */
function supabaseWrites(store: MemoryStore, outcome: unknown, rpc: [string, Record<string, unknown>][]) {
  const answer = (table: string) => (table === "chat_messages"
    ? { data: { id: "00000000-0000-4000-8000-000000000001" }, error: null }
    : { data: { start_date: store.trip.startDate, end_date: store.trip.endDate }, error: null });
  const chain = (table: string): unknown => new Proxy({}, {
    get: (_t, key) => (key === "single" || key === "maybeSingle" ? async () => answer(table) : key === "then" ? undefined : () => chain(table)),
  });
  const db = {
    from: (table: string) => chain(table),
    rpc: async (name: string, args: Record<string, unknown>) => { rpc.push([name, args]); return { data: outcome, error: null }; },
  } as unknown as SupabaseClient;
  const sb = new SupabaseStore(db, store.trip.id, "user-1");
  store.append = sb.append.bind(sb);
  store.applyProposal = sb.applyProposal.bind(sb);
}

function deps(opts: { tiers?: Record<string, CoverageTier>; hidePlace?: string; failApply?: boolean; outcome?: unknown; failDiscard?: boolean; trips?: number } = {}) {
  const rpc: [string, Record<string, unknown>][] = [];
  const reads: string[] = [];
  const catalogue = new MemoryStore({ tiers: opts.tiers });
  const created: MemoryStore[] = [];
  const discarded: string[] = [];
  const d: ReadyMadeStartDeps = {
    tripCount: async () => opts.trips ?? 0,
    catalogue: {
      cities: () => { reads.push("cities"); return catalogue.cities(); },
      graph: () => catalogue.graph(),
      // As places_public would: a place that isn't verified isn't there.
      places: async (cityId) => (await catalogue.places(cityId)).filter((p) => p.id !== opts.hidePlace),
    },
    create: async (meta) => {
      const store = new MemoryStore({ tiers: opts.tiers, trip: { ...meta, id: `trip-${created.length + 1}` } as Partial<TripMeta> });
      if (opts.outcome !== undefined) supabaseWrites(store, opts.outcome, rpc);
      if (opts.failApply) store.applyProposal = async () => { throw new Error("database said no"); };
      created.push(store);
      return { id: store.trip.id, store };
    },
    discard: async (id) => {
      discarded.push(id);
      if (opts.failDiscard) throw new Error("delete refused");
    },
  };
  return { d, created, discarded, rpc, reads };
}

afterEach(() => { vi.restoreAllMocks(); });

describe("parseReadyMadeStart", () => {
  it("reads a known trip, a real start date and the party size", () => {
    expect(parseReadyMadeStart(form({ trip: "kyoto-nara-3", startDate: "2027-05-10", people: "2" }), NOW))
      .toEqual({ ok: true, value: { tripId: "kyoto-nara-3", startDate: "2027-05-10", people: 2 } });
  });

  it("counts one person when none is given", () => {
    const r = parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2027-05-10" }), NOW);
    expect(r.ok && r.value.people).toBe(1);
  });

  it("needs a start date: the engine plans closing days on real dates", () => {
    expect(parseReadyMadeStart(form({ trip: "osaka-day", people: "1" }), NOW)).toEqual({ ok: false, error: e.startDate });
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2027-02-30" }), NOW)).toEqual({ ok: false, error: e.startDate });
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "next week" }), NOW)).toEqual({ ok: false, error: e.startDate });
  });

  it("refuses a first day already past in Japan, with a day's slack for travellers west of it", () => {
    expect(tokyoToday(NOW)).toBe("2026-11-19");
    // Tokyo is a day ahead of UTC from 15:00 UTC.
    expect(tokyoToday(new Date("2026-11-19T16:00:00Z"))).toBe("2026-11-20");
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2026-11-19" }), NOW).ok).toBe(true);
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2026-11-18" }), NOW).ok).toBe(true);
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2026-11-17" }), NOW)).toEqual({ ok: false, error: e.past });
    const late = new Date("2026-11-19T16:00:00Z");
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2026-11-19" }), late).ok).toBe(true);
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2026-11-18" }), late)).toEqual({ ok: false, error: e.past });
  });

  it("refuses a trip that isn't on the list", () => {
    expect(parseReadyMadeStart(form({ trip: "made-up", startDate: "2027-05-10" }), NOW)).toEqual({ ok: false, error: e.trip });
    expect(parseReadyMadeStart(form({ startDate: "2027-05-10" }), NOW)).toEqual({ ok: false, error: e.trip });
  });

  it("keeps the party between 1 and 20, whole", () => {
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2027-05-10", people: "0" }), NOW)).toEqual({ ok: false, error: copy.trips.errors.minPeople });
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2027-05-10", people: "21" }), NOW)).toEqual({ ok: false, error: copy.trips.errors.maxPeople });
    expect(parseReadyMadeStart(form({ trip: "osaka-day", startDate: "2027-05-10", people: "1.5" }), NOW)).toEqual({ ok: false, error: copy.trips.errors.wholePeople });
  });
});

describe("availableReadyMade", () => {
  it("offers only trips whose every city is planned on live, day trips included", () => {
    const ids = availableReadyMade(new Map(Object.entries(LIVE))).map((t) => t.id);
    expect(ids).toEqual(["kyoto-east", "kyoto-arashiyama", "osaka-day", "nara-day", "kyoto-2", "kyoto-nara-3", "osaka-kyoto-nara-5"]);
  });

  it("counts a city the coverage view doesn't list as not planned", () => {
    const tiers = new Map(Object.entries(LIVE));
    tiers.delete("nara-city");
    expect(availableReadyMade(tiers).map((t) => t.id)).not.toContain("kyoto-nara-3");
  });

  it("offers every trip once all nine cities are planned", () => {
    const all = new Map(Object.keys(LIVE).map((id) => [id, "outline" as CoverageTier]));
    expect(availableReadyMade(all)).toHaveLength(readyMadeTrips.length);
  });
});

describe("startReadyMade", () => {
  it("creates the trip, saves the route and plans every day with the must-sees pinned", async () => {
    const { d, created, discarded } = deps();
    const trip = tripById("osaka-kyoto-nara-5");
    const r = await startReadyMade(d, { tripId: trip.id, startDate: "2027-05-10", people: 3 });
    expect(r).toEqual({ ok: true, tripId: "trip-1" });
    expect(discarded).toEqual([]);

    const s = await created[0].state();
    expect(s.trip).toMatchObject({ title: copy.readyMade.trips[trip.id].title, startDate: "2027-05-10", endDate: "2027-05-14", partySize: 3 });
    expect(s.cities.map((c) => [c.cityId, c.nights])).toEqual(trip.route.map((c) => [c.cityId, c.nights]));
    expect(s.cities.map((c) => c.reason)).toEqual(trip.route.map((c) => copy.readyMade.trips[trip.id].reasons[c.cityId as keyof (typeof copy.readyMade.trips)[typeof trip.id]["reasons"]]));

    expect(s.days.map((x) => [x.date, x.cityId])).toEqual([
      ["2027-05-10", "osaka-city"],
      ["2027-05-11", "osaka-city"],
      ["2027-05-12", "kyoto-city"],
      ["2027-05-13", "nara-city"],
      ["2027-05-14", "kyoto-city"],
    ]);
    s.days.forEach((day, i) => {
      for (const id of trip.mustSee[i]) {
        const item = day.items.find((it) => it.placeId === id);
        expect(item, `${day.date}: ${id}`).toBeDefined();
        expect(item!.locked, `${day.date}: ${id}`).toBe(true);
      }
      // The engine filled the rest of the day around the pins.
      expect(day.items.length, day.date).toBeGreaterThan(trip.mustSee[i].length);
    });

    // Saved through the proposal path: one message, its proposal accepted,
    // and a proposal the Supabase store's schema check would take.
    expect(created[0].messages).toHaveLength(1);
    expect(() => ProposalSchema.parse(created[0].messages[0].proposal)).not.toThrow();
    expect(created[0].messages[0]).toMatchObject({ role: "assistant", status: "accepted", content: copy.readyMade.picker.started(copy.readyMade.trips[trip.id].title) });
  });

  it("sends apply_proposal the route and every day, pins kept, each with an empty base", async () => {
    const { d, rpc } = deps({ outcome: "applied" });
    const trip = tripById("osaka-kyoto-nara-5");
    expect(await startReadyMade(d, { tripId: trip.id, startDate: "2027-05-10", people: 1 })).toEqual({ ok: true, tripId: "trip-1" });
    expect(rpc.map(([name]) => name)).toEqual(["apply_proposal"]);
    const args = rpc[0][1] as { p_route: { city_id: string; nights: number }[]; p_days: { date: string; city_id: string; base: unknown[]; items: { place_id: string; locked: boolean }[] }[]; p_expect_start: string };
    expect(args.p_expect_start).toBe("2027-05-10");
    expect(args.p_route.map((c) => [c.city_id, c.nights])).toEqual(trip.route.map((c) => [c.cityId, c.nights]));
    expect(args.p_days).toHaveLength(trip.days);
    args.p_days.forEach((day, i) => {
      expect(day.base).toEqual([]);
      for (const id of trip.mustSee[i]) expect(day.items.some((it) => it.place_id === id && it.locked), `${day.date}: ${id}`).toBe(true);
    });
  });

  it.each([
    ["stale_day", "the day changed under it"],
    ["something else", "an outcome the store can't read"],
  ])("throws the trip away and says it didn't start when apply_proposal returns %s (%s)", async (outcome) => {
    const { d, discarded } = deps({ outcome });
    expect(await startReadyMade(d, { tripId: "osaka-day", startDate: "2027-05-10", people: 1 })).toEqual({ ok: false, error: e.failed });
    expect(discarded).toEqual(["trip-1"]);
  });

  it("lays a day trip there and back from where the traveller sleeps, as the chat's route card does", async () => {
    const { d, created } = deps();
    await startReadyMade(d, { tripId: "osaka-kyoto-nara-5", startDate: "2027-05-10", people: 1 });
    const route = (created[0].messages[0].proposal as Proposal).route!;
    expect(route.legs!.map((l) => [l.fromCityId, l.toCityId, l.movingTo])).toEqual([
      ["osaka-city", "kyoto-city", "kyoto-city"],
      ["kyoto-city", "nara-city", null],
      ["nara-city", "kyoto-city", null],
    ]);
  });

  it("starts a one-day trip", async () => {
    const { d, created } = deps();
    const r = await startReadyMade(d, { tripId: "osaka-day", startDate: "2027-05-11", people: 1 });
    expect(r.ok).toBe(true);
    const s = await created[0].state();
    expect(s.trip).toMatchObject({ startDate: "2027-05-11", endDate: "2027-05-11" });
    expect(s.days).toHaveLength(1);
    expect(s.days[0].items.some((it) => it.placeId === "osk-osaka-castle" && it.locked)).toBe(true);
  });

  it("plans at the traveller's saved pace", async () => {
    const { d, created } = deps();
    const create = d.create;
    d.create = async (meta) => {
      const made = await create(meta);
      await made.store.savePreferences({ pace: "relaxed" });
      return made;
    };
    await startReadyMade(d, { tripId: "kyoto-2", startDate: "2027-05-10", people: 1 });
    const relaxed = (await created[0].state()).days.reduce((n, x) => n + x.items.length, 0);
    const other = deps();
    await startReadyMade(other.d, { tripId: "kyoto-2", startDate: "2027-05-10", people: 1 });
    const standard = (await other.created[0].state()).days.reduce((n, x) => n + x.items.length, 0);
    expect(relaxed).toBeLessThan(standard);
  });

  it("refuses a trip through a stub city on the server too, and creates nothing", async () => {
    const { d, created } = deps({ tiers: LIVE });
    expect(await startReadyMade(d, { tripId: "classic-7", startDate: "2027-05-10", people: 2 })).toEqual({ ok: false, error: e.notYet });
    expect(await startReadyMade(d, { tripId: "kansai-hiroshima-7", startDate: "2027-05-10", people: 2 })).toEqual({ ok: false, error: e.notYet });
    expect(created).toHaveLength(0);
  });

  it("refuses when a must-see isn't public yet, and creates nothing", async () => {
    const { d, created } = deps({ hidePlace: "nra-todaiji" });
    expect(await startReadyMade(d, { tripId: "kyoto-nara-3", startDate: "2027-05-10", people: 1 })).toEqual({ ok: false, error: e.notYet });
    expect(created).toHaveLength(0);
  });

  it("refuses a start that puts a must-see on a day it closes every year, and creates nothing", async () => {
    const { d, created } = deps();
    expect(await startReadyMade(d, { tripId: "osaka-day", startDate: "2026-12-30", people: 1 }))
      .toEqual({ ok: false, error: e.closedYearly("Osaka Castle", "28 Dec – 1 Jan", "Wed 30 Dec") });
    expect(await startReadyMade(d, { tripId: "osaka-day", startDate: "2027-01-01", people: 1 }))
      .toEqual({ ok: false, error: e.closedYearly("Osaka Castle", "28 Dec – 1 Jan", "Fri 1 Jan") });
    // Day 2 of the five days is 31 Dec.
    expect(await startReadyMade(d, { tripId: "osaka-kyoto-nara-5", startDate: "2026-12-30", people: 2 }))
      .toEqual({ ok: false, error: e.closedYearly("Osaka Castle", "28 Dec – 1 Jan", "Thu 31 Dec") });
    expect(created).toHaveLength(0);
    // A day later the castle is open again on its day.
    expect((await startReadyMade(d, { tripId: "osaka-day", startDate: "2027-01-02", people: 1 })).ok).toBe(true);
  });

  it("throws the half-made trip away when the save fails", async () => {
    const { d, created, discarded } = deps({ failApply: true });
    expect(await startReadyMade(d, { tripId: "osaka-day", startDate: "2027-05-10", people: 1 })).toEqual({ ok: false, error: e.failed });
    expect(created).toHaveLength(1);
    expect(discarded).toEqual(["trip-1"]);
  });

  it("logs a failed clean-up and still tells the traveller it didn't start", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, discarded } = deps({ failApply: true, failDiscard: true });
    expect(await startReadyMade(d, { tripId: "osaka-day", startDate: "2027-05-10", people: 1 })).toEqual({ ok: false, error: e.failed });
    expect(discarded).toEqual(["trip-1"]);
    expect(log.mock.calls.some((c) => String(c[0]).includes("Discarding") && c.includes("delete refused"))).toBe(true);
  });

  it("stops at the trip cap before reading anything", async () => {
    const { d, created, reads } = deps({ trips: TRIP_CAP });
    expect(await startReadyMade(d, { tripId: "osaka-day", startDate: "2027-05-10", people: 1 })).toEqual({ ok: false, error: e.tooManyTrips(TRIP_CAP) });
    expect(reads).toEqual([]);
    expect(created).toHaveLength(0);
  });

  it("says why when the trip itself can't be created (the trip cap, the write allowance)", async () => {
    const { d } = deps();
    d.create = async () => { throw new Error("You have reached the limit of 100 trips."); };
    expect(await startReadyMade(d, { tripId: "osaka-day", startDate: "2027-05-10", people: 1 })).toEqual({ ok: false, error: "You have reached the limit of 100 trips." });
  });
});
