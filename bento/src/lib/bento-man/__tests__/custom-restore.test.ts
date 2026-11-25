/** Codex reviews 3 and 4, 26 Nov 2026: what restoring a free-text stop to
 *  its saved time does to the rest of the day. */
import { describe, expect, it } from "vitest";
import { copy } from "@/copy";
import type { DayPlan, PlaceInput } from "@/lib/engine/types";
import { restoreCustomStops } from "../custom-restore";
import type { ItemRow } from "../store";

type Item = DayPlan["items"][number];
type Leg = NonNullable<Item["arriveBy"]>;
const W = copy.plan.warnings;
const walk = { mode: "walk", minutes: 7, fareJpy: 0, fareKind: "exact", detail: "Walk" } as unknown as Leg;
const guess = { ...walk, mode: "estimate", minutes: 45, fareKind: "estimate" } as unknown as Leg;

const own = (id: string, startMin: number | null, durationMin: number): ItemRow => ({
  placeId: `custom:${id}`, customName: id, name: id, sortOrder: 0, startMin, durationMin,
  locked: false, reason: "", reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null,
});
const stop = (placeId: string, startMin: number, durationMin: number, extra: Partial<Item> = {}): Item =>
  ({ placeId, name: placeId, category: "x", startMin, endMin: startMin + durationMin, durationMin, locked: false, reason: "r", reasonTerms: [], arriveBy: null, alternatives: [], costJpy: 100, score: {}, ...extra }) as unknown as Item;
const plan = (items: Item[], extra: Partial<DayPlan> = {}): DayPlan =>
  ({ date: "2026-12-21", startMin: items[0].startMin, dayStartMin: 9 * 60, dayEndMin: 19 * 60, endMin: 0, budgetMin: 480, activeMin: 0, slackMin: 0, placesJpy: items.length * 100, faresJpy: 0, costJpy: 0, fareKind: "exact", meals: [], considered: [], warnings: [], items, ...extra }) as unknown as DayPlan;
const using = (over: Record<string, Partial<PlaceInput>> = {}, pins: Record<string, number | null> = {}) => ({
  places: ["b", "d", "e"].map((id) => ({ id, category: "x", closesAt: null, opensAt: null, bestWindow: [], ...over[id] }) as unknown as PlaceInput),
  locked: Object.entries(pins).map(([placeId, startMin]) => ({ placeId, startMin })),
  travel: () => walk,
});
const rows = (p: DayPlan) => p.items.map((i) => [i.placeId, i.startMin, i.endMin]);

describe("restoreCustomStops", () => {
  it("says a stop the journey makes late, though the stop before ends in time", () => {
    const p = restoreCustomStops(plan([stop("b", 1080, 45), stop("custom:k", 1170, 90, { arriveBy: guess })]), [own("k", 1140, 90)], using());
    expect(rows(p)).toEqual([["b", 1080, 1125], ["custom:k", 1140, 1230]]);
    expect(p.warnings).toEqual([W.pinnedLate("custom:k", "19:00", "19:30")]);
  });

  it("starts a pin left on top of it after it, and says the pin is late and past closing", () => {
    const p = restoreCustomStops(
      plan([stop("b", 1170, 30, { locked: true }), stop("custom:k", 1245, 90, { arriveBy: guess })], { warnings: [W.pinnedLate("custom:k", "19:00", "20:45")] }),
      [own("k", 1140, 90)], using({ b: { closesAt: "21:00" } }, { b: 1170 }));
    expect(rows(p)).toEqual([["custom:k", 1140, 1230], ["b", 1275, 1305]]);
    expect(p.warnings).toEqual([W.pinnedLate("b", "19:30", "21:15"), W.closesDuring("b", "21:00", "21:45")]);
    expect(p.items.map((i) => i.arriveBy?.mode ?? null)).toEqual([null, "estimate"]);
  });

  it("gives two Bento stops it no longer sits between their own leg", () => {
    const p = restoreCustomStops(
      plan([stop("b", 1080, 90, { locked: true }), stop("custom:k", 1215, 90, { arriveBy: guess }), stop("d", 1350, 30, { locked: true, arriveBy: guess })]),
      [own("k", 1020, 90)], using());
    expect(p.items.map((i) => [i.placeId, i.arriveBy?.mode ?? null])).toEqual([["custom:k", null], ["b", "estimate"], ["d", "walk"]]);
  });

  it("sends a pushed stop past the next fixed one when it doesn't fit before it, and the rest follow in order", () => {
    const p = restoreCustomStops(
      plan([stop("custom:a", 600, 240), stop("b", 630, 60), stop("custom:c", 890, 30), stop("d", 750, 45)]),
      [own("a", 600, 240), own("c", 890, 30)], using());
    expect(rows(p)).toEqual([["custom:a", 600, 840], ["custom:c", 890, 920], ["b", 965, 1025], ["d", 1032, 1077]]);
  });

  it("keeps Bento's stops off two fixed ones that overlap (Codex's cascade)", () => {
    const p = restoreCustomStops(
      plan([stop("custom:a", 600, 240), stop("b", 630, 60), stop("custom:c", 690, 30), stop("d", 750, 45)]),
      [own("a", 600, 240), own("c", 690, 30)], using());
    expect(p.items.map((i) => i.placeId)).toEqual(["custom:a", "custom:c", "b", "d"]);
    const [, , b, d] = p.items;
    expect(b.startMin).toBeGreaterThanOrEqual(840);
    expect(d.startMin).toBeGreaterThanOrEqual(b.endMin);
    expect(p.warnings).toContain(W.pinnedShort("custom:c", "11:30", "14:00", 150));
  });

  it("leaves out a chosen stop pushed past its closing, the day's end or daylight, with the reason and its cost", () => {
    const closing = restoreCustomStops(plan([stop("custom:t", 900, 120), stop("b", 930, 60)]), [own("t", 900, 120)], using({ b: { closesAt: "17:00" } }));
    expect(rows(closing)).toEqual([["custom:t", 900, 1020]]);
    expect(closing.considered[0]).toMatchObject({ placeId: "b", term: "hours" });
    expect(closing.placesJpy).toBe(100);
    const end = restoreCustomStops(plan([stop("custom:t", 900, 120), stop("b", 930, 90)]), [own("t", 900, 120)], using());
    expect(end.considered[0]).toMatchObject({ placeId: "b", term: "day_end" });
    const dark = restoreCustomStops(plan([stop("custom:t", 780, 60), stop("b", 800, 90)]), [own("t", 780, 60)], using({ b: { category: "hike", lat: 35.68, lon: 139.69 } }));
    expect(dark.considered[0]).toMatchObject({ placeId: "b", term: "hours" });
    expect(dark.considered[0].detail).toMatch(/daylight/);
  });

  it("says every overlap when one free-text stop holds two others (review 6)", () => {
    const p = restoreCustomStops(
      plan([stop("custom:a", 600, 240), stop("custom:b", 690, 30), stop("custom:c", 780, 30)]),
      [own("a", 600, 240), own("b", 690, 30), own("c", 780, 30)], using());
    expect(rows(p)).toEqual([["custom:a", 600, 840], ["custom:b", 690, 720], ["custom:c", 780, 810]]);
    expect(p.warnings).toEqual([W.pinnedShort("custom:b", "11:30", "14:00", 150), W.pinnedShort("custom:c", "13:00", "14:00", 60)]);
  });

  it("never leaves out a free-text stop without a time (review 5)", () => {
    const p = restoreCustomStops(
      plan([stop("b", 1140, 60, { locked: true }), stop("custom:a", 1245, 60, { arriveBy: guess }), stop("custom:u", 1350, 60, { arriveBy: guess })]),
      [own("a", 1170, 60), own("u", null, 60)], using({}, { b: 1140 }));
    expect(p.items.map((i) => i.placeId).sort()).toEqual(["b", "custom:a", "custom:u"]);
    for (const i of p.items) expect(i.endMin).toBeLessThanOrEqual(24 * 60);
  });

  it("lets a stop in its evening window run past the day's end, as the planner does", () => {
    const p = restoreCustomStops(plan([stop("custom:t", 1080, 60), stop("b", 1110, 60)]), [own("t", 1080, 60)], using({ b: { bestWindow: ["after 17:30"] } }));
    expect(rows(p)).toEqual([["custom:t", 1080, 1140], ["b", 1185, 1245]]);
    expect(p.considered).toEqual([]);
  });

  it("counts the flat guess for a journey Bento has no route for", () => {
    const p = restoreCustomStops(
      plan([stop("b", 1080, 60, { locked: true }), stop("custom:k", 1200, 60, { arriveBy: guess }), stop("d", 1305, 30, { locked: true, arriveBy: guess })]),
      [own("k", 900, 60)], { ...using(), travel: () => null });
    expect(p.items.map((i) => i.placeId)).toEqual(["custom:k", "b", "d"]);
    expect(p.items[2].arriveBy).toMatchObject({ mode: "estimate", minutes: 45 });
    expect(p.activeMin).toBe(60 + 60 + 30 + 45 + 45);
  });

  it("keeps lunch only in a gap the journey leaves room for", () => {
    const make = (b: number) => restoreCustomStops(
      plan([stop("custom:t", 660, 60), stop("b", b, 60, { locked: true, arriveBy: guess })], { meals: [{ kind: "lunch", startMin: 735, endMin: 795 }] }),
      [own("t", 660, 60)], using());
    expect(make(780).meals).toEqual([]);
    expect(make(800).meals).toEqual([]);
    expect(make(840).meals).toHaveLength(1);
  });

  it("keeps a pin, and never past midnight", () => {
    const p = restoreCustomStops(plan([stop("custom:t", 1350, 90), stop("b", 1380, 30, { locked: true })]), [own("t", 1350, 90)], using({}, { b: 1380 }));
    expect(rows(p)).toEqual([["custom:t", 1350, 1440], ["b", 1380, 1410]]);
    expect(p.warnings).toContain(W.pinnedShort("b", "23:00", "24:00", 60));
  });

  it("doesn't call the first stop late for the planner's own later first visit", () => {
    const p = restoreCustomStops(plan([stop("b", 1170, 30, { locked: true }), stop("custom:k", 1245, 60)], { dayStartMin: 11 * 60 }), [own("k", 1140, 60)], using());
    expect(p.warnings.filter((w) => w.startsWith("custom:k"))).toEqual([]);
  });

  it("takes the sums, the day's ends and lunch from the final day", () => {
    const p = restoreCustomStops(
      plan([stop("custom:t", 720, 60), stop("b", 730, 60, { locked: true, arriveBy: guess })], { meals: [{ kind: "lunch", startMin: 720, endMin: 780 }] }),
      [own("t", 720, 60)], using());
    expect(p.activeMin).toBe(60 + 60 + 45);
    expect(p.slackMin).toBe(480 - 165);
    expect(p.fareKind).toBe("estimate");
    expect([p.startMin, p.endMin]).toEqual([720, 885]);
    expect(p.meals).toEqual([]);
    expect(p.costJpy).toBe(p.placesJpy + p.faresJpy);
  });

  it("returns the plan as it was when no free-text stop has a time", () => {
    const p = plan([stop("b", 600, 60), stop("custom:u", 700, 60)]);
    const before = JSON.stringify(p.items.map((i) => [i.placeId, i.startMin, i.endMin]));
    restoreCustomStops(p, [own("u", null, 60)], using());
    expect(JSON.stringify(rows(p))).toBe(before);
  });
});
