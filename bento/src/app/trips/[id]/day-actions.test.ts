/** "Re-plan this day" when the engine can't: the page shows words from
 *  copy, never the error written for Bento Man (review F-03). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";
import { MemoryStore } from "@/lib/bento-man/store.memory";
import { replanDay, runTool, type ToolContext } from "@/lib/bento-man/tools";

const mocks = vi.hoisted(() => ({ store: null as unknown }));

vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }),
}));
vi.mock("@/lib/bento-man/store.supabase", () => ({
  SupabaseStore: function SupabaseStore() { return mocks.store; },
}));

import { replanDayAction, togglePin } from "./day-actions";

const TRIP = "11111111-1111-4111-8111-111111111111";
const nov = { startDate: "2026-11-20", endDate: "2026-11-29" };
const routed = () => new MemoryStore({ trip: nov, cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }] });

async function planned(date: string) {
  const store = routed();
  const ctx: ToolContext = { store, today: "2026-09-15", proposal: null };
  await runTool("plan_days", { dates: [{ date }] }, ctx);
  await store.applyProposal(ctx.proposal!);
  return store;
}

async function errorShown(date: string): Promise<string | null> {
  const form = new FormData();
  form.set("tripId", TRIP);
  form.set("date", date);
  const thrown = await replanDayAction(form).then(() => null, (e: Error) => e.message);
  const to = new URL(String(thrown).replace(/^redirect:/, ""), "https://bento.test");
  return to.searchParams.get("error");
}

beforeEach(() => { mocks.store = null; });

describe("re-plan this day, on a travel day", () => {
  it("starts after the move, even when the day was saved at the old start", async () => {
    const store = await planned("2026-11-22");
    const day = (await store.state()).days.find((d) => d.date === "2026-11-22")!;
    // As saved before travel days allowed for the move: first stop at 09:00.
    await store.saveDay({ ...day, items: day.items.map((it, i) => ({ ...it, locked: false, startMin: i === 0 ? 9 * 60 : it.startMin })) });
    mocks.store = store;
    const append = vi.spyOn(store, "append");
    const form = new FormData();
    form.set("tripId", TRIP);
    form.set("date", "2026-11-22");
    await replanDayAction(form).catch(() => null);
    const proposal = append.mock.calls[0][2]!;
    expect(proposal.days![0].after[0].startMin).toBeGreaterThan(9 * 60 + 60);
    // The lift is said, with the arrival time to five minutes (09:00 + 89
    // min: the hour's allowance and the 29-minute Special Rapid).
    expect(proposal.days![0].warnings).toContain(copy.plan.warnings.liftedStart("10:30", "Osaka"));
  });

  it("an edit lifts a start saved before the move and says so on the page", async () => {
    const store = await planned("2026-11-22");
    const day = (await store.state()).days.find((d) => d.date === "2026-11-22")!;
    await store.saveDay({ ...day, items: day.items.map((it, i) => ({ ...it, locked: false, startMin: i === 0 ? 9 * 60 : it.startMin })) });
    mocks.store = store;
    const to = await redirectOf(togglePin, "2026-11-22", day.items[1].placeId);
    expect(to.searchParams.get("note")).toBe("start-lifted");
    const saved = (await store.state()).days.find((d) => d.date === "2026-11-22")!;
    expect(saved.items[0].startMin).toBeGreaterThan(9 * 60 + 60);
  });
});

describe("re-plan this day and edits, on an ordinary day", () => {
  it("re-plan with no pins keeps the first stop's start exactly as before", async () => {
    const store = await planned("2026-11-24");
    const day = (await store.state()).days.find((d) => d.date === "2026-11-24")!;
    await store.saveDay({ ...day, items: day.items.map((it, i) => ({ ...it, locked: false, startMin: i === 0 ? 10 * 60 + 10 : it.startMin })) });
    mocks.store = store;
    // Before: the action sent the first stop's start as start_at.
    const before = await replanDay(store, "2026-11-24", [{ op: "start_at", time: "10:10" }]);
    if (!("diff" in before)) throw new Error(before.error);
    const append = vi.spyOn(store, "append");
    const form = new FormData();
    form.set("tripId", TRIP);
    form.set("date", "2026-11-24");
    await replanDayAction(form).catch(() => null);
    expect(append.mock.calls[0][2]!.days![0]).toEqual(before.diff);
  });

  it("an edit still works, with no note, when the city list can't be read", async () => {
    const store = await planned("2026-11-24");
    const day = (await store.state()).days.find((d) => d.date === "2026-11-24")!;
    vi.spyOn(store, "cities").mockRejectedValue(new Error("down"));
    mocks.store = store;
    const to = await redirectOf(togglePin, "2026-11-24", day.items[0].placeId);
    expect(to.searchParams.get("note")).toBeNull();
    const saved = (await store.state()).days.find((d) => d.date === "2026-11-24")!;
    expect(saved.items[0].locked).toBe(!day.items[0].locked);
  });
});

async function redirectOf(action: (f: FormData) => Promise<void>, date: string, placeId: string): Promise<URL> {
  const form = new FormData();
  form.set("tripId", TRIP);
  form.set("date", date);
  form.set("placeId", placeId);
  const thrown = await action(form).then(() => "", (e: Error) => e.message);
  return new URL(thrown.replace(/^redirect:/, ""), "https://bento.test");
}

describe("re-plan this day, when it can't", () => {
  it("shows the copy line, not the model's error, for a pinned stop from another city", async () => {
    const store = await planned("2026-11-28");
    const day = (await store.state()).days.find((d) => d.date === "2026-11-28")!;
    await store.saveDay({ ...day, items: [{ ...day.items[0], placeId: "miy-itsukushima", locked: true }, ...day.items.slice(1)] });
    mocks.store = store;
    const shown = await errorShown("2026-11-28");
    expect(shown).toBe(copy.trip.replan.errors.placeGone);
    expect(shown).not.toMatch(/plan_days|place_id|Nothing was proposed/);
  });

  it("shows the copy line for a pinned stop Bento no longer has", async () => {
    const store = await planned("2026-11-24");
    const day = (await store.state()).days.find((d) => d.date === "2026-11-24")!;
    await store.saveDay({ ...day, items: [{ ...day.items[0], placeId: "kyt-gone", locked: true }] });
    mocks.store = store;
    expect(await errorShown("2026-11-24")).toBe(copy.trip.replan.errors.placeGone);
  });

  it("shows the copy line for a date that isn't a day of the trip", async () => {
    mocks.store = routed();
    expect(await errorShown("2026-12-30")).toBe(copy.trip.replan.errors.notADay);
  });
});
