import { describe, expect, it } from "vitest";
import { copy } from "@/copy";
import { arriveMinutesSuffix } from "../arrive-line";

describe("the line between two stops", () => {
  it("doesn't repeat the minutes a walk's own words already give", () => {
    // "Walk · 14 min · 14 min" was shown for every walk.
    expect(copy.plan.transit.walkOnly(14)).toContain("14");
    expect(copy.plan.transit.walkStraight(14)).toContain("14");
    expect(arriveMinutesSuffix("walk", 14)).toBeNull();
    // The no-train-data estimate says "About 45 min — …" itself too.
    expect(copy.plan.warnings.noTrainData(45, "A", "B")).toContain("45");
    expect(arriveMinutesSuffix("estimate", 45)).toBeNull();
  });

  it("adds the door-to-door minutes to a train journey, and nothing when unknown", () => {
    expect(arriveMinutesSuffix("rail", 31)).toBe(31);
    expect(arriveMinutesSuffix("bus", 12)).toBe(12);
    expect(arriveMinutesSuffix("rail", null)).toBeNull();
    expect(arriveMinutesSuffix(null, 45)).toBe(45);
  });

  it("says a straight walk is an estimate, leading with the walk", () => {
    expect(copy.plan.transit.walkStraight(14)).toBe("About a 14-min walk");
  });
});
