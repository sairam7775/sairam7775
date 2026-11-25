/** A re-plan keeps a traveller's own free-text stop (0036): it is a fixed
 *  block at its saved time and length, the planner's stops fit around it,
 *  and it is never removed (owner decision, 25 Nov 2026). */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { copy } from "@/copy";
import { buildGraph } from "@/lib/transit/graph";
import { MemoryStore } from "../store.memory";
import { SupabaseStore } from "../store.supabase";
import { runTool, type ToolContext } from "../tools";
import type { DayRow, ItemRow } from "../store";

vi.mock("@/lib/transit/load", () => ({ loadGraph: async () => buildGraph([], []) }));

const row = { locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null };
const keiko: ItemRow = { ...row, placeId: "custom:dinner-at-aunt-keiko-s", customName: "Dinner at Aunt Keiko's", name: "Dinner at Aunt Keiko's", sortOrder: 2, startMin: 19 * 60, durationMin: 90 };
const day: DayRow = { date: "2026-11-23", cityId: "kyoto-city", items: [
  { ...row, placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", sortOrder: 0, startMin: 540, durationMin: 90 },
  { ...row, placeId: "kyt-nishiki-market", name: "Nishiki Market", sortOrder: 1, startMin: 720, durationMin: 60 },
  keiko,
] };
const trip = (days: DayRow[] = [day]) => new MemoryStore({
  trip: { title: "Kansai, autumn", startDate: "2026-11-20", endDate: "2026-11-29", partySize: 2 },
  prefs: { pace: "standard" },
  cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }],
  days,
});

async function replan(store: MemoryStore, ops: unknown[]) {
  const ctx: ToolContext = { store, today: "2026-11-01", proposal: null };
  const r = await runTool("replan_day", { date: "2026-11-23", ops }, ctx);
  return { result: JSON.parse(r.result), proposal: ctx.proposal };
}

describe("replan_day keeps a free-text stop", () => {
  it("at its time and length, never removed, with the planner's stops around it", async () => {
    const { result, proposal } = await replan(trip(), [{ op: "start_at", time: "11:00" }]);
    expect(result.day.removed).not.toContain("Dinner at Aunt Keiko's");
    const stop = result.day.stops.find((s: { name: string }) => s.name === "Dinner at Aunt Keiko's");
    expect(stop).toMatchObject({ time: "19:00–20:30", change: "kept", place_id: "custom:dinner-at-aunt-keiko-s" });
    const after = proposal!.days![0].after;
    expect(after.find((a) => a.placeId === keiko.placeId)).toMatchObject({ startMin: 19 * 60, durationMin: 90, locked: false, reason: "" });
    // Bento's own stops, around it, none overlapping it.
    const others = after.filter((a) => a.placeId !== keiko.placeId);
    expect(others.length).toBeGreaterThan(0);
    for (const a of others) expect(a.endMin <= 19 * 60 || a.startMin >= 20 * 60 + 30, a.name).toBe(true);
  });

  it("its legs are the same guess the day box shows, not a station warning", async () => {
    const { proposal } = await replan(trip(), [{ op: "start_at", time: "11:00" }]);
    const d = proposal!.days![0];
    const at = d.after.findIndex((a) => a.placeId === keiko.placeId);
    expect(at).toBeGreaterThan(0);
    expect(d.after[at]).toMatchObject({ arriveMode: "estimate", arriveMinutes: 45, arriveDetail: copy.plan.warnings.uncheckedLeg(45) });
    expect(d.warnings.join(" ")).not.toMatch(/Keiko[^.]*station/);
  });

  it("a start after it can't move it: it stays, and the result says it can't be reached in time", async () => {
    const { result } = await replan(trip(), [{ op: "start_at", time: "20:00" }]);
    expect(result.day.removed).not.toContain("Dinner at Aunt Keiko's");
    expect(result.day.stops.map((s: { name: string }) => s.name)).toContain("Dinner at Aunt Keiko's");
    expect(result.day.warnings.some((w: string) => /Dinner at Aunt Keiko's/.test(w) && /19:00/.test(w))).toBe(true);
  });

  it("the same name on another day doesn't count it as already planned", async () => {
    const other: DayRow = { date: "2026-11-24", cityId: "kyoto-city", items: [{ ...keiko, sortOrder: 0 }] };
    const { result } = await replan(trip([day, other]), [{ op: "start_at", time: "11:00" }]);
    expect(result.day.warnings.join(" ")).not.toMatch(/already in the trip/);
  });

  it("Re-plan this day keeps it too, and accepting writes it back as the traveller's own stop", async () => {
    const store = trip();
    const { proposal } = await replan(store, [{ op: "start_at", time: "11:00" }]);
    await store.applyProposal(proposal!);
    const saved = (await store.state()).days.find((d) => d.date === "2026-11-23")!;
    expect(saved.items.find((i) => i.placeId === keiko.placeId)).toMatchObject({ customName: "Dinner at Aunt Keiko's", startMin: 19 * 60, durationMin: 90 });
  });
});

describe("plan_days keeps a free-text stop on a day that has one", () => {
  it("unpinned, it is kept at its time", async () => {
    const ctx: ToolContext = { store: trip([{ ...day, items: [keiko] }]), today: "2026-11-01", proposal: null };
    const r = JSON.parse((await runTool("plan_days", { dates: [{ date: "2026-11-23" }] }, ctx)).result);
    expect(r.days[0].removed).not.toContain("Dinner at Aunt Keiko's");
    expect(r.days[0].stops.find((s: { name: string }) => s.name === "Dinner at Aunt Keiko's")).toMatchObject({ time: "19:00–20:30" });
  });
});

describe("the Supabase store writes a kept free-text stop as itself", () => {
  it("place_id null and its name, in the proposal's days", async () => {
    const { proposal } = await replan(trip(), [{ op: "start_at", time: "11:00" }]);
    const rpc = vi.fn(async () => ({ data: "applied", error: null }));
    const db = { rpc, from: () => { throw new Error("no reads"); } } as unknown as SupabaseClient;
    await new SupabaseStore(db, "trip", "user").applyProposal(proposal!, "message");
    const days = (rpc.mock.calls[0] as unknown as [string, { p_days: { items: Record<string, unknown>[] }[] }])[1].p_days;
    const written = days[0].items.find((i) => i.custom_name === "Dinner at Aunt Keiko's");
    expect(written).toMatchObject({ place_id: "", custom_name: "Dinner at Aunt Keiko's", start_time: "19:00", duration_min: "90" });
    expect(days[0].items.filter((i) => i.custom_name == null).every((i) => typeof i.place_id === "string" && !String(i.place_id).startsWith("custom:"))).toBe(true);
  });
});

describe("a free-text stop is a fixed interval (review 3, #1)", () => {
  const at = (p: NonNullable<Awaited<ReturnType<typeof replan>>["proposal"]>, id: string) => p.days![0].after.find((a) => a.placeId === id)!;

  it("a 20:00 start leaves the 19:00 dinner at 19:00–20:30, in the proposal and once accepted, and says the day reaches it late", async () => {
    const store = trip();
    const { result, proposal } = await replan(store, [{ op: "start_at", time: "20:00" }]);
    expect(at(proposal!, keiko.placeId)).toMatchObject({ startMin: 19 * 60, endMin: 20 * 60 + 30 });
    expect(result.day.stops.find((s: { name: string }) => s.name === "Dinner at Aunt Keiko's").time).toBe("19:00–20:30");
    // Kept at 19:00, and told the day only gets there at 20:00.
    expect(result.day.warnings).toContain(copy.plan.warnings.pinnedLate("Dinner at Aunt Keiko's", "19:00", "20:00"));
    await store.applyProposal(proposal!);
    const saved = (await store.state()).days.find((d) => d.date === "2026-11-23")!.items.find((i) => i.placeId === keiko.placeId)!;
    expect(saved).toMatchObject({ startMin: 19 * 60, durationMin: 90 });
  });

  it("two that overlap both keep their saved times, and the overlap is said", async () => {
    const tea: ItemRow = { ...keiko, placeId: "custom:tea-with-sachi", customName: "Tea with Sachi", name: "Tea with Sachi", sortOrder: 3, startMin: 20 * 60, durationMin: 60 };
    const store = trip([{ ...day, items: [...day.items, tea] }]);
    const { result, proposal } = await replan(store, [{ op: "start_at", time: "11:00" }]);
    expect(at(proposal!, keiko.placeId)).toMatchObject({ startMin: 19 * 60, endMin: 20 * 60 + 30 });
    expect(at(proposal!, tea.placeId)).toMatchObject({ startMin: 20 * 60, endMin: 21 * 60 });
    // In time order, and said once: the dinner runs into the tea.
    const order = proposal!.days![0].after.map((x) => x.placeId);
    expect(order.indexOf(keiko.placeId)).toBe(order.indexOf(tea.placeId) - 1);
    expect(result.day.warnings.filter((w: string) => w.startsWith("Tea with Sachi") || w.startsWith("Dinner at Aunt Keiko's"))).toEqual([copy.plan.warnings.pinnedShort("Tea with Sachi", "20:00", "20:30", 30)]);
    const starts = proposal!.days![0].after.map((x) => x.startMin);
    expect(starts).toEqual([...starts].sort((p, q) => p - q));
    await store.applyProposal(proposal!);
    const saved = (await store.state()).days.find((d) => d.date === "2026-11-23")!.items;
    expect(saved.find((i) => i.placeId === tea.placeId)).toMatchObject({ startMin: 20 * 60, durationMin: 60 });
  });
});

describe("pins and a free-text stop on one day", () => {
  const pin = (placeId: string, name: string, startMin: number | null, durationMin = 45): ItemRow => ({ ...row, placeId, name, sortOrder: 0, startMin, durationMin, locked: true });
  const onDay = (items: ItemRow[]) => trip([{ ...day, items }]);

  it("a pin during the dinner is planned after it and said to be late, never on top of it", async () => {
    const { result, proposal } = await replan(onDay([pin("kyt-gion", "Gion — Hanamikoji", 19 * 60 + 30), keiko]), [{ op: "start_at", time: "11:00" }]);
    const after = proposal!.days![0].after;
    const gion = after.find((a) => a.placeId === "kyt-gion")!;
    expect(after.find((a) => a.placeId === keiko.placeId)).toMatchObject({ startMin: 19 * 60, endMin: 20 * 60 + 30 });
    expect(gion.startMin).toBeGreaterThanOrEqual(20 * 60 + 30 + 45);
    expect(gion).toMatchObject({ arriveMode: "estimate", arriveMinutes: 45 });
    expect(result.day.warnings.some((w: string) => w.startsWith("Gion — Hanamikoji is pinned for 19:30"))).toBe(true);
  });

  it("every leg to or from the dinner is the guess, and the day's first stop has none", async () => {
    for (const items of [[pin("kyt-gion", "Gion", 19 * 60 + 30), keiko], [pin("kyt-nishiki-market", "Nishiki Market", null), keiko]])
      for (const time of ["11:00", "20:00"]) {
        const { proposal } = await replan(onDay(items), [{ op: "start_at", time }]);
        const after = proposal!.days![0].after;
        expect(after[0].arriveMode ?? null).toBeNull();
        const k = after.findIndex((a) => a.placeId === keiko.placeId);
        if (k > 0) expect(after[k]).toMatchObject({ arriveMode: "estimate", arriveMinutes: 45 });
        if (after[k + 1]) expect(after[k + 1]).toMatchObject({ arriveMode: "estimate", arriveMinutes: 45 });
      }
  });
});

describe("the result tells Bento Man the traveller's own stop stays", () => {
  it("with its time, as data, and asks him to say so; a day without one says nothing extra", async () => {
    const { result } = await replan(trip(), [{ op: "start_at", time: "11:00" }]);
    expect(result.day.own_stops).toEqual([{ name: "Dinner at Aunt Keiko's", time: "19:00–20:30" }]);
    expect(result.day.own_stops_note).toMatch(/stay/);
    // The traveller's words stay data, never part of the instruction.
    expect(result.day.own_stops_note).not.toMatch(/Keiko/);
    const { result: none } = await replan(trip([{ ...day, items: day.items.slice(0, 2) }]), [{ op: "start_at", time: "11:00" }]);
    expect(none.day).not.toHaveProperty("own_stops");
    expect(none.day).not.toHaveProperty("own_stops_note");
  });

  it("and the day's end and active time follow the day as restored", async () => {
    const { proposal } = await replan(trip(), [{ op: "start_at", time: "20:00" }]);
    const d = proposal!.days![0];
    const active = d.after.reduce((s, a) => s + a.durationMin + (a.arriveMinutes ?? 0), 0);
    expect(d.activeMin).toBe(active);
  });
});
