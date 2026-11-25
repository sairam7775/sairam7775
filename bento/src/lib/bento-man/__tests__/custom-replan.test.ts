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
