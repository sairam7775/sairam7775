import { describe, expect, it } from "vitest";
import { copy } from "@/copy";
import type { DayPlan } from "@/lib/engine/types";
import { baseMatches, computeDayDiff, dayBase, parseProposal, type Proposal } from "../diff";
import { MemoryStore } from "../store.memory";
import { runTool, type ToolContext } from "../tools";
import type { DayRow, ItemRow } from "../store";

const item = (placeId: string, sortOrder: number): ItemRow => ({
  placeId, name: placeId, sortOrder, startMin: 540 + sortOrder * 90, durationMin: 60,
  locked: false, reason: "reason", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null,
});
const day = (): DayRow => ({ date: "2026-11-23", cityId: "kyoto-city", items: [item("a", 0), item("b", 1), item("c", 2)] });
const plan: DayPlan = {
  date: "2026-11-23", cityId: "kyoto-city", items: [], meals: [], dayStartMin: 540, dayEndMin: 1140, startMin: 540, endMin: 1020,
  budgetMin: 480, activeMin: 0, slackMin: 480, placesJpy: 0, faresJpy: 0, costJpy: 0,
  fareKind: "exact", considered: [], warnings: [],
};
const propose = (d: DayRow): Proposal => parseProposal({ summary: "Plan", days: [computeDayDiff(d.items, plan)] })!;

describe("stale day proposals", () => {
  const edits: Record<string, (items: ItemRow[]) => ItemRow[]> = {
    reorderDay: (items) => [...items].reverse(),
    moveItem: ([a, b, c]) => [b, a, c],
    togglePin: (items) => items.map((i, n) => n === 0 ? { ...i, locked: true } : i),
    removeItem: (items) => items.slice(1),
  };
  for (const [name, edit] of Object.entries(edits)) {
    it(`refuses and closes after ${name}, preserving the hand edit`, async () => {
      const original = day();
      const store = new MemoryStore({ days: [original] });
      const p = propose(original);
      const { id } = await store.append("assistant", "Plan", p);
      await store.saveDay({ ...original, items: edit(original.items) });
      const before = await store.state();
      await expect(store.applyProposal(p, id)).rejects.toThrow(copy.trip.proposals.staleDay);
      expect((await store.state()).days).toEqual(before.days);
      expect(store.messages.find((m) => m.id === id)?.status).toBe("rejected");
      await expect(store.applyProposal(p, id)).rejects.toThrow(copy.trip.proposals.answered);
    });
  }
  it("applies with no hand edit", async () => {
    const store = new MemoryStore({ days: [day()] });
    const p = propose(day());
    const { id } = await store.append("assistant", "Plan", p);
    await store.applyProposal(p, id);
    expect(store.days[0].items).toEqual([]);
    expect(store.messages[0].status).toBe("accepted");
  });
  it("accepts an old proposal without a base", async () => {
    const store = new MemoryStore({ days: [day()] });
    const p = propose(day());
    delete p.days[0].base;
    await store.saveDay({ ...day(), items: [] });
    await expect(store.applyProposal(p)).resolves.toBeUndefined();
  });
  it("distinguishes an empty base from an absent one", async () => {
    const empty = { ...day(), items: [] };
    const p = propose(empty);
    expect(p.days[0].base).toEqual([]);
    const store = new MemoryStore();
    await expect(store.applyProposal(p)).resolves.toBeUndefined();
    await store.saveDay(day());
    const { id } = await store.append("assistant", "Plan", p);
    await expect(store.applyProposal(p, id)).rejects.toThrow(copy.trip.proposals.staleDay);
    expect(store.days[0].items).toEqual(day().items);
    expect(store.messages[0].status).toBe("rejected");
  });
  it("catches a proposal saved after the hand edit, computed before it", async () => {
    const store = new MemoryStore({ days: [day()] });
    const p = propose((await store.state()).days[0]);
    await store.saveDay({ ...day(), items: [] });
    const { id } = await store.append("assistant", "Plan", p);
    await expect(store.applyProposal(p, id)).rejects.toThrow(copy.trip.proposals.staleDay);
    expect(store.messages[0].status).toBe("rejected");
  });
  it("refuses the whole proposal before changing another day or the route", async () => {
    const other = { ...day(), date: "2026-11-24" };
    const store = new MemoryStore({ days: [day(), other], cities: [{ cityId: "kyoto-city", nights: 3 }] });
    const p = propose(day());
    p.days.unshift({ ...computeDayDiff(other.items, { ...plan, date: other.date }) });
    p.route = { kind: "route", before: [], after: [], summary: "Route", verdict: "fine", arithmetic: "" };
    const { id } = await store.append("assistant", "Plan", p);
    const unrelated = await store.append("assistant", "Other", { summary: "Other", days: [] });
    await store.saveDay({ ...day(), items: [] });
    const before = await store.state();
    await expect(store.applyProposal(p, id)).rejects.toThrow(copy.trip.proposals.staleDay);
    const after = await store.state();
    expect(after.days).toEqual(before.days);
    expect(after.cities).toEqual(before.cities);
    expect(store.messages.find((m) => m.id === unrelated.id)?.status).toBe("proposed");
  });
  it("snapshots timing and travel fields but ignores display names and row ids", async () => {
    for (const patch of [
      { startMin: 555 }, { durationMin: 75 }, { arriveMode: "walk" },
      { arriveMinutes: 15 }, { arriveDetail: "Walk" },
    ]) {
      const store = new MemoryStore({ days: [day()] });
      const p = propose(day());
      await store.saveDay({ ...day(), items: day().items.map((i, n) => n ? i : { ...i, ...patch }) });
      await expect(store.applyProposal(p)).rejects.toThrow(copy.trip.proposals.staleDay);
    }
    const store = new MemoryStore({ days: [day()] });
    const p = propose(day());
    await store.saveDay({ ...day(), items: day().items.map((i) => ({ ...i, name: "New name", id: "new-id" })) });
    await expect(store.applyProposal(p)).resolves.toBeUndefined();
  });
  describe("stops that share a sort order", () => {
    const a = { ...item("b-place", 1), startMin: 600 };
    const b = { ...item("a-place", 1), startMin: 660 };
    const c = item("z-first", 0);
    it("give the same base whichever order the rows arrive in", () => {
      expect(dayBase([c, a, b])).toEqual(dayBase([b, c, a]));
      // sort order, then place id (byte order), then the remaining fields
      expect(dayBase([a, b, c]).map((i) => i.placeId)).toEqual(["z-first", "a-place", "b-place"]);
      const sameId = [{ ...item("p", 0), startMin: null }, { ...item("p", 0), startMin: 700 }];
      expect(dayBase(sameId).map((i) => i.startMin)).toEqual([700, null]);
      expect(dayBase([...sameId].reverse())).toEqual(dayBase(sameId));
    });
    it("apply when unchanged even if the saved rows come back in another order", async () => {
      const store = new MemoryStore({ days: [{ ...day(), items: [c, a, b] }] });
      const p = propose({ ...day(), items: [c, a, b] });
      const { id } = await store.append("assistant", "Plan", p);
      store.days[0].items = [b, a, c];
      await expect(store.applyProposal(p, id)).resolves.toBeUndefined();
    });
    it("are still refused after a real edit among the tied stops", async () => {
      const store = new MemoryStore({ days: [{ ...day(), items: [c, a, b] }] });
      const p = propose({ ...day(), items: [c, a, b] });
      const { id } = await store.append("assistant", "Plan", p);
      await store.saveDay({ ...day(), items: [c, a, { ...b, locked: true }] });
      store.days[0].items = store.days[0].items.map((i) => ({ ...i, sortOrder: i.placeId === "z-first" ? 0 : 1 }));
      await expect(store.applyProposal(p, id)).rejects.toThrow(copy.trip.proposals.staleDay);
    });
    it("are compared without re-sorting the stored base, as the database does", () => {
      const saved = [c, a, b];
      const base = dayBase(saved);
      expect(baseMatches(base, [b, a, c])).toBe(true);
      expect(baseMatches([base[0], base[2], base[1]], saved)).toBe(false);
    });
  });

  describe("a route change and day plans in the same turn", () => {
    const prefs = { pace: "standard" as const, interestTags: ["art", "nature"] as ("art" | "nature")[], energy: 0.4, crowdTolerance: 0.6, discovery: 0.5, excludes: [] };
    const D = "2026-11-20";
    // Turn 1: Osaka 2 / Kyoto 5 / Hiroshima 2, plan 20 Nov (Osaka) and accept it.
    async function afterTurnOne() {
      const store = new MemoryStore({
        trip: { startDate: "2026-11-20", endDate: "2026-11-29" }, prefs,
        cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }],
      });
      const ctx: ToolContext = { store, today: "2026-09-15", proposal: null };
      expect((await runTool("plan_days", { dates: [{ date: D }] }, ctx)).isError).toBeFalsy();
      const { id } = await store.append("assistant", "Plan", ctx.proposal!);
      await store.applyProposal(ctx.proposal!, id);
      const saved = (await store.state()).days.find((d) => d.date === D)!;
      expect(saved.cityId).toBe("osaka-city");
      expect(saved.items.length).toBeGreaterThan(0);
      return store;
    }
    // Turn 2: drop Osaka, start in Kyoto, and plan days in the same turn.
    async function turnTwo(store: MemoryStore, planInput: object) {
      const ctx: ToolContext = { store, today: "2026-09-15", proposal: null };
      expect((await runTool("propose_route", { cities: [{ city_id: "kyoto-city", nights: 7, reason: "Kyoto first" }, { city_id: "hiroshima-city", nights: 2, reason: "then west" }] }, ctx)).isError).toBeFalsy();
      expect((await runTool("plan_days", planInput, ctx)).isError).toBeFalsy();
      const p = ctx.proposal!;
      const { id } = await store.append("assistant", "Route and days", p);
      return { p, id };
    }

    for (const [name, input] of [["with dates", { dates: [{ date: D }] }], ["without dates", {}]] as const) {
      it(`applies ${name}, with the base taken from the day as saved, and the day ends in the new city`, async () => {
        const store = await afterTurnOne();
        const saved = (await store.state()).days.find((d) => d.date === D)!;
        const { p, id } = await turnTwo(store, input);
        expect(p.days.find((d) => d.date === D)!.base).toEqual(dayBase(saved.items));
        await expect(store.applyProposal(p, id)).resolves.toBeUndefined();
        const after = await store.state();
        expect(after.days.find((d) => d.date === D)!.cityId).toBe("kyoto-city");
        expect(after.cities.map((c) => c.cityId)).toEqual(["kyoto-city", "hiroshima-city"]);
        expect(store.messages.find((m) => m.id === id)?.status).toBe("accepted");
      });
    }

    it("is refused when the saved day is edited by hand between proposing and accepting", async () => {
      const store = await afterTurnOne();
      const { p, id } = await turnTwo(store, { dates: [{ date: D }] });
      const saved = (await store.state()).days.find((d) => d.date === D)!;
      await store.saveDay({ ...saved, items: saved.items.slice(1) });
      const before = await store.state();
      await expect(store.applyProposal(p, id)).rejects.toThrow(copy.trip.proposals.staleDay);
      const after = await store.state();
      expect(after.days).toEqual(before.days);
      expect(after.cities.map((c) => c.cityId)).toEqual(["osaka-city", "kyoto-city", "hiroshima-city"]);
      expect(store.messages.find((m) => m.id === id)?.status).toBe("rejected");
    });
  });

  it("leaves combined dates and days unchecked until original dates are recorded", async () => {
    const store = new MemoryStore({ days: [day()] });
    const p = propose(day());
    const fields = { startDate: null, endDate: null, title: "Test trip", partySize: 1 };
    p.dates = { kind: "dates", before: fields, after: fields, summary: "Dates" };
    await store.saveDay({ ...day(), items: [] });
    await expect(store.applyProposal(p)).resolves.toBeUndefined();
  });
});
