import { describe, expect, it } from "vitest";
import { copy } from "@/copy";
import { BACKGROUNDS, SCENE_THEMES, SEASONS, isBackground, isSeason, noise, parseBackground, previewOf, seasonOf } from "./season";

describe("parseBackground", () => {
  it("keeps a chosen season", () => {
    expect(parseBackground("spring")).toBe("spring");
    expect(parseBackground("winter")).toBe("winter");
  });

  it("keeps a chosen scene", () => {
    expect(parseBackground("tsuyu")).toBe("tsuyu");
    expect(parseBackground("fuji")).toBe("fuji");
    expect(parseBackground("night")).toBe("night");
    expect(parseBackground("matsuri")).toBe("matsuri");
    expect(parseBackground("shrine")).toBe("shrine");
  });

  it("is automatic for anything else", () => {
    expect(parseBackground(undefined)).toBe("auto");
    expect(parseBackground("auto")).toBe("auto");
    expect(parseBackground("monsoon")).toBe("auto");
    expect(parseBackground("Fuji")).toBe("auto");
    expect(parseBackground("night-city")).toBe("auto");
  });
});

describe("the Background choices", () => {
  it("are Automatic, the four seasons, then the five scenes", () => {
    expect(BACKGROUNDS).toEqual(["auto", "spring", "summer", "autumn", "winter", "tsuyu", "fuji", "night", "matsuri", "shrine"]);
  });

  it("each have a label in Settings", () => {
    for (const value of BACKGROUNDS) expect(copy.settings.background[value]).toMatch(/\S/);
  });
});

describe("previewOf", () => {
  it("reads ?season= for any season or scene", () => {
    expect(previewOf("?season=winter")).toBe("winter");
    expect(previewOf("?season=fuji")).toBe("fuji");
    expect(previewOf("?tab=x&season=matsuri")).toBe("matsuri");
  });

  it("ignores anything it can't show", () => {
    expect(previewOf("")).toBeNull();
    expect(previewOf("?season=auto")).toBeNull();
    expect(previewOf("?season=monsoon")).toBeNull();
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
  it("only ever gives one of the four seasons, never a scene", () => {
    for (let m = 0; m < 12; m++) expect(SEASONS).toContain(seasonOf(new Date(2026, m, 10)));
  });
});

describe("helpers", () => {
  it("isSeason accepts only the four names", () => {
    expect(isSeason("autumn")).toBe(true);
    expect(isSeason("monsoon")).toBe(false);
    expect(isSeason("fuji")).toBe(false);
    expect(isSeason(null)).toBe(false);
  });
  it("isBackground accepts the seasons and the scenes, not auto", () => {
    for (const s of [...SEASONS, ...SCENE_THEMES]) expect(isBackground(s)).toBe(true);
    expect(isBackground("auto")).toBe(false);
    expect(isBackground("monsoon")).toBe(false);
    expect(isBackground(undefined)).toBe(false);
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
