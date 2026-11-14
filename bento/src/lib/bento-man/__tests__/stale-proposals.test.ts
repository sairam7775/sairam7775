import { describe, expect, it } from "vitest";
import { copy } from "@/copy";
import type { DayPlan } from "@/lib/engine/types";
import { computeDayDiff, parseProposal, type Proposal } from "../diff";
import { MemoryStore } from "../store.memory";
import type { DayRow, ItemRow } from "../store";

const item = (placeId: string, sortOrder: number): ItemRow => ({
  placeId, name: placeId, sortOrder, startMin: 540 + sortOrder * 90, durationMin: 60,
  locked: false, reason: "reason", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null,
});
const day = (): DayRow => ({ date: "2026-11-23", cityId: "kyoto-city", items: [item("a", 0), item("b", 1), item("c", 2)] });
const plan: DayPlan = {
  date: "2026-11-23", cityId: "kyoto-city", items: [], meals: [], startMin: 540, endMin: 1020,
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
  it("leaves combined dates and days unchecked until original dates are recorded", async () => {
    const store = new MemoryStore({ days: [day()] });
    const p = propose(day());
    const fields = { startDate: null, endDate: null, title: "Test trip", partySize: 1 };
    p.dates = { kind: "dates", before: fields, after: fields, summary: "Dates" };
    await store.saveDay({ ...day(), items: [] });
    await expect(store.applyProposal(p)).resolves.toBeUndefined();
  });
});
