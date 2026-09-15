import { describe, expect, it } from "vitest";
import { dayStats } from "../day-stats";

describe("dayStats", () => {
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
