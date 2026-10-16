import { describe, expect, it } from "vitest";
import { isSeason, noise, parseBackground, seasonOf } from "./season";

describe("parseBackground", () => {
  it("keeps a chosen season", () => {
    expect(parseBackground("spring")).toBe("spring");
    expect(parseBackground("winter")).toBe("winter");
  });

  it("is automatic for anything else", () => {
    expect(parseBackground(undefined)).toBe("auto");
    expect(parseBackground("auto")).toBe("auto");
    expect(parseBackground("monsoon")).toBe("auto");
  });
});

describe("seasonOf", () => {
  it("follows Japan's seasons by month", () => {
    expect(seasonOf("2026-03-01")).toBe("spring");
    expect(seasonOf("2026-05-31")).toBe("spring");
    expect(seasonOf("2026-06-01")).toBe("summer");
    expect(seasonOf("2026-08-31")).toBe("summer");
    expect(seasonOf("2026-09-01")).toBe("autumn");
    expect(seasonOf("2026-11-20")).toBe("autumn");
    expect(seasonOf("2026-12-01")).toBe("winter");
    expect(seasonOf("2027-02-28")).toBe("winter");
  });
  it("takes a Date too", () => {
    expect(seasonOf(new Date(2026, 0, 15))).toBe("winter");
  });
});

describe("helpers", () => {
  it("isSeason accepts only the four names", () => {
    expect(isSeason("autumn")).toBe(true);
    expect(isSeason("monsoon")).toBe(false);
    expect(isSeason(null)).toBe(false);
  });
  it("noise is deterministic and in [0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      const n = noise(i, 3);
      expect(n).toBe(noise(i, 3));
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});
