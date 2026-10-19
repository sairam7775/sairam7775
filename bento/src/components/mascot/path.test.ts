import { describe, expect, it } from "vitest";
import { toContours } from "./path";

const round = (cs: ReturnType<typeof toContours>) =>
  JSON.parse(JSON.stringify(cs, (_k, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)));

describe("toContours", () => {
  it("closes a polygon and drops no vertices", () => {
    expect(round(toContours("M0 0L10 0L10 10Z"))).toEqual([
      { c: true, v: [[0, 0], [10, 0], [10, 10]], i: [[0, 0], [0, 0], [0, 0]], o: [[0, 0], [0, 0], [0, 0]] },
    ]);
  });

  it("splits subpaths and reads relative h and v", () => {
    const cs = toContours("M32 4v56M4 32h56");
    expect(cs.map((c) => c.v)).toEqual([[[32, 4], [32, 60]], [[4, 32], [60, 32]]]);
    expect(cs.every((c) => !c.c)).toBe(true);
  });

  it("turns a quadratic into cubic tangents", () => {
    const [c] = round(toContours("M0 0q4 4 8 0"));
    expect(c.v).toEqual([[0, 0], [8, 0]]);
    expect(c.o[0]).toEqual([2.667, 2.667]);
    expect(c.i[1]).toEqual([-2.667, 2.667]);
  });

  it("reflects the control point for t", () => {
    const [c] = round(toContours("M27 53q1.5 -2 3 0t3 0"));
    expect(c.v).toEqual([[27, 53], [30, 53], [33, 53]]);
    // The reflected control is (31.5, 55); the out-tangent from (30, 53) is 2/3 of (1.5, 2).
    expect(c.o[1]).toEqual([1, 1.333]);
  });

  it("tokenises numbers with no separators", () => {
    expect(toContours("M1 1l.5-1.5")[0].v).toEqual([[1, 1], [1.5, -0.5]]);
  });

  it("refuses numbers after a close instead of looping", () => {
    expect(() => toContours("M0 0L1 1Z 3 4")).toThrow(/command/);
  });

  it("drops a closing vertex that repeats the first", () => {
    const [c] = toContours("M0 0h10v10h-10z");
    expect(c.c).toBe(true);
    expect(c.v).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
});
