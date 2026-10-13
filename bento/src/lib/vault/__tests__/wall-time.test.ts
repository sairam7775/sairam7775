import { describe, expect, it } from "vitest";
import { isWallTime, stamp } from "../wall-time";

describe("isWallTime", () => {
  it("accepts a date and a date with a time", () => {
    expect(isWallTime("2026-11-20")).toBe(true);
    expect(isWallTime("2026-11-20T15:00")).toBe(true);
    expect(isWallTime("2026-11-20T15:00:30")).toBe(true);
    expect(isWallTime("2028-02-29")).toBe(true);
  });
  it("rejects impossible dates and times, and other shapes", () => {
    for (const bad of ["2026-02-30", "2026-13-01", "2026-11-20T25:00", "2026-11-20T10:61", "20-11-2026", "tomorrow", "2026-11-20 15:00", "2026-11-20T15:00Z"]) {
      expect(isWallTime(bad), bad).toBe(false);
    }
  });
});

describe("stamp", () => {
  it("stores the wall time as UTC, whatever the server's timezone", () => {
    expect(stamp("2026-11-21T02:00")).toBe("2026-11-21T02:00:00.000Z");
    expect(stamp("2026-11-21")).toBe("2026-11-21T00:00:00.000Z");
    expect(stamp("")).toBeNull();
    expect(stamp(undefined)).toBeNull();
  });
});
