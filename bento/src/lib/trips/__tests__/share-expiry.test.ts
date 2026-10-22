import { describe, expect, it } from "vitest";
import { shareExpiry, shareExpiryOptions, shareIsActive } from "../share-expiry";

const NOW = new Date("2026-11-20T12:30:00.000Z");

describe("companions' link expiry", () => {
  it("maps each choice to what is stored", () => {
    expect(shareExpiry("never", "2026-11-27", NOW)).toEqual({ expires_at: null, until_trip_end: false });
    expect(shareExpiry("7-days", null, NOW)).toEqual({ expires_at: "2026-11-27T12:30:00.000Z", until_trip_end: false });
    expect(shareExpiry("30-days", null, NOW)).toEqual({ expires_at: "2026-12-20T12:30:00.000Z", until_trip_end: false });
    // The choice itself, so the link follows the trip if its dates change.
    expect(shareExpiry("trip-end", "2026-11-27", NOW)).toEqual({ expires_at: null, until_trip_end: true });
  });

  it("does not offer or accept trip end once the trip is over", () => {
    expect(shareExpiryOptions("2026-11-20", NOW)).toContain("trip-end");
    expect(shareExpiryOptions("2026-11-19", NOW)).toEqual(["never", "7-days", "30-days"]);
    expect(() => shareExpiry("trip-end", "2026-11-19", NOW)).toThrow(RangeError);
  });

  it("does not offer or accept trip end without an end date", () => {
    expect(shareExpiryOptions(null, NOW)).toEqual(["never", "7-days", "30-days"]);
    expect(() => shareExpiry("trip-end", null, NOW)).toThrow(RangeError);
    expect(() => shareExpiry("trip-end", "2026-02-30", NOW)).toThrow(RangeError);
  });

  it("says a fixed link works until its expiry instant, and never without a share", () => {
    expect(shareIsActive(null, "2026-11-27", NOW)).toBe(false);
    expect(shareIsActive({ expires_at: null, until_trip_end: false }, null, NOW)).toBe(true);
    expect(shareIsActive({ expires_at: "2026-11-20T12:30:01.000Z", until_trip_end: false }, null, NOW)).toBe(true);
    expect(shareIsActive({ expires_at: "2026-11-20T12:30:00.000Z", until_trip_end: false }, null, NOW)).toBe(false);
  });

  it("keeps a link until the trip ends working through the trip's current last day", () => {
    const untilEnd = { expires_at: null, until_trip_end: true };
    expect(shareIsActive(untilEnd, "2026-11-20", NOW)).toBe(true);
    expect(shareIsActive(untilEnd, "2026-11-20", new Date("2026-11-21T00:00:00.000Z"))).toBe(false);
    expect(shareIsActive(untilEnd, "2026-11-19", NOW)).toBe(false);
    expect(shareIsActive(untilEnd, "2026-12-01", NOW)).toBe(true);
    expect(shareIsActive(untilEnd, null, NOW)).toBe(false);
  });
});
