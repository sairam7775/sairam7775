import { describe, expect, it } from "vitest";
import { shareExpiresAt, shareExpiryOptions, shareIsActive } from "../share-expiry";

const NOW = new Date("2026-11-20T12:30:00.000Z");

describe("companions' link expiry", () => {
  it("maps each choice to its expiry instant", () => {
    expect(shareExpiresAt("never", "2026-11-27", NOW)).toBeNull();
    expect(shareExpiresAt("7-days", null, NOW)).toBe("2026-11-27T12:30:00.000Z");
    expect(shareExpiresAt("30-days", null, NOW)).toBe("2026-12-20T12:30:00.000Z");
    expect(shareExpiresAt("trip-end", "2026-11-27", NOW)).toBe("2026-11-28T00:00:00.000Z");
  });

  it("does not offer or accept trip end without an end date", () => {
    expect(shareExpiryOptions(null)).toEqual(["never", "7-days", "30-days"]);
    expect(() => shareExpiresAt("trip-end", null, NOW)).toThrow(RangeError);
  });

  it("says a link works until its expiry instant, and never without a share", () => {
    expect(shareIsActive(null, NOW)).toBe(false);
    expect(shareIsActive({ expires_at: null }, NOW)).toBe(true);
    expect(shareIsActive({ expires_at: "2026-11-20T12:30:01.000Z" }, NOW)).toBe(true);
    expect(shareIsActive({ expires_at: "2026-11-20T12:30:00.000Z" }, NOW)).toBe(false);
    expect(shareIsActive({ expires_at: "2026-11-19T00:00:00.000Z" }, NOW)).toBe(false);
  });
});
