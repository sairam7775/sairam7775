import { describe, expect, it } from "vitest";
import { computeDayDiff, mergeProposals, parseProposal } from "../diff";
import type { DayPlan } from "@/lib/engine/types";

const item = (placeId: string, startMin: number, locked = false): DayPlan["items"][number] => ({
  placeId, name: placeId, category: "temple", startMin, endMin: startMin + 60, durationMin: 60, locked,
  score: { total: 1, terms: [] }, reason: "because", reasonTerms: ["interest_match"], arriveBy: null, alternatives: [], costJpy: 500,
});
const plan = (items: DayPlan["items"]): DayPlan => ({
  date: "2026-11-23", cityId: "kyoto-city", items, meals: [], startMin: 540, endMin: 1020, budgetMin: 480, activeMin: 300, slackMin: 180,
  placesJpy: 1000, faresJpy: 300, costJpy: 1300, fareKind: "estimate", considered: [], warnings: [],
});

describe("computeDayDiff", () => {
  it("flags kept, added, moved and removed against the existing day", () => {
    const existing = [
      { placeId: "a", name: "a", sortOrder: 0, startMin: 540, locked: false },
      { placeId: "b", name: "b", sortOrder: 1, startMin: 660, locked: false },
      { placeId: "c", name: "c", sortOrder: 2, startMin: 780, locked: false },
    ];
    const d = computeDayDiff(existing, plan([item("c", 540), item("a", 660), item("d", 780)]));
    expect(d.after.map((i) => [i.placeId, i.change])).toEqual([["c", "moved"], ["a", "moved"], ["d", "added"]]);
    expect(d.removed).toEqual([{ placeId: "b", name: "b" }]);
    expect(d.summary).toMatch(/1 added, 1 removed, 2 moved/);
    // Dropping the first stop shifts every clock but moves nothing.
    const shifted = computeDayDiff(existing, plan([item("b", 540), item("c", 660)]));
    expect(shifted.after.map((i) => i.change)).toEqual(["kept", "kept"]);
    expect(d.summary).toMatch(/~¥1,300/);
  });
  it("a fresh day is all additions and says how many stops", () => {
    const d = computeDayDiff([], plan([item("a", 540), item("b", 660)]));
    expect(d.after.every((i) => i.change === "added")).toBe(true);
    expect(d.summary).toMatch(/^2 stops/);
  });
});

describe("proposals", () => {
  it("round-trip through the schema and reject junk", () => {
    const d = computeDayDiff([], plan([item("a", 540)]));
    const p = { summary: "1 day", days: [d] };
    expect(parseProposal(JSON.parse(JSON.stringify(p)))).toEqual(p);
    expect(parseProposal({ summary: "x", days: [{ kind: "day" }] })).toBeNull();
    expect(parseProposal("nope")).toBeNull();
  });
  it("merge keeps one diff per date, later wins", () => {
    const a = { summary: "a", days: [computeDayDiff([], plan([item("a", 540)]))] };
    const b = { summary: "b", days: [computeDayDiff([], plan([item("b", 540)]))] };
    const m = mergeProposals(a, b);
    expect(m.days).toHaveLength(1);
    expect(m.days[0].after[0].placeId).toBe("b");
    expect(m.summary).toBe("1 day");
  });
});
