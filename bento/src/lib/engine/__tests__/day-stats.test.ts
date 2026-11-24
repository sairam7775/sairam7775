import { describe, expect, it } from "vitest";
import { dayStats, fillPercent } from "../day-stats";

describe("fillPercent", () => {
  it("is the share of the day used, capped at 100, and never NaN for a day with no time left", () => {
    expect(fillPercent(240, 480)).toBe(50);
    expect(fillPercent(600, 480)).toBe(100);
    expect(fillPercent(0, 0)).toBe(0);
    expect(fillPercent(30, 0)).toBe(100);
  });
});

describe("dayStats", () => {
  it("measures a travel day against the day less the move", () => {
    const items = [{ startMin: 600, durationMin: 300, arriveMinutes: null }];
    expect(dayStats(items, "standard").budgetMin).toBe(480);
    const moved = dayStats(items, "standard", 73);
    expect(moved.budgetMin).toBe(407);
    expect(moved.overBy).toBe(0);
    expect(dayStats(items, "relaxed", 73).overBy).toBe(300 - (360 - 73));
  });

  it("sums places and legs, finds the lunch gap, and marks where the budget runs out", () => {
    const s = dayStats(
      [
        { startMin: 420, durationMin: 90, arriveMinutes: null },
        { startMin: 525, durationMin: 60, arriveMinutes: 15 },
        { startMin: 780, durationMin: 50, arriveMinutes: 20 },
        { startMin: 860, durationMin: 240, arriveMinutes: 30 },
        { startMin: 1130, durationMin: 120, arriveMinutes: 30 },
      ],
      "relaxed",
    );
    expect(s.budgetMin).toBe(360);
    expect(s.activeMin).toBe(90 + 15 + 60 + 20 + 50 + 30 + 240 + 30 + 120);
    expect(s.overBy).toBe(s.activeMin - 360);
    expect(s.overFromIndex).toBe(3);
    expect(s.lunch).toEqual({ startMin: 690, endMin: 750 });
  });

  it("says where the day has free time: a gap of over two hours, after lunch and before the next leg", () => {
    // kansai-hiroshima-7 day 1 (12 Dec 2026): Namba Yasaka Shrine ends
    // 14:29, then nothing until Dotonbori at 17:30, a 10-minute walk.
    const s = dayStats(
      [
        { startMin: 540, durationMin: 30, arriveMinutes: null },
        { startMin: 651, durationMin: 60, arriveMinutes: 34 },
        { startMin: 776, durationMin: 60, arriveMinutes: 5 },
        { startMin: 849, durationMin: 20, arriveMinutes: 13 },
        { startMin: 1050, durationMin: 75, arriveMinutes: 10 },
        { startMin: 1129, durationMin: 30, arriveMinutes: 4 },
      ],
      "standard",
    );
    expect(s.freeTime).toEqual([{ startMin: 869, endMin: 1040, beforeIndex: 4 }]);
    // Lunch inside a long gap comes first; what is left after it is the free time.
    const withLunch = dayStats(
      [
        { startMin: 540, durationMin: 150, arriveMinutes: null },
        { startMin: 1050, durationMin: 30, arriveMinutes: 20 },
      ],
      "standard",
    );
    expect(withLunch.lunch).toEqual({ startMin: 690, endMin: 750 });
    expect(withLunch.freeTime).toEqual([{ startMin: 750, endMin: 1030, beforeIndex: 1 }]);
    // Two hours or less is not free time: an evening stop's usual wait.
    expect(dayStats([
      { startMin: 540, durationMin: 60, arriveMinutes: null },
      { startMin: 730, durationMin: 60, arriveMinutes: 10 },
    ], "standard").freeTime).toEqual([]);
  });

  it("is empty for an empty day and has no lunch when there is no gap", () => {
    expect(dayStats([], "standard")).toMatchObject({ activeMin: 0, overBy: 0, overFromIndex: null, lunch: null });
    const s = dayStats(
      [
        { startMin: 600, durationMin: 240, arriveMinutes: null },
        { startMin: 850, durationMin: 60, arriveMinutes: 10 },
      ],
      "standard",
    );
    expect(s.lunch).toBeNull();
    expect(s.overBy).toBe(0);
  });
});
