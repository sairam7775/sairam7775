import { describe, expect, it } from "vitest";
import { costBand, costBandWords } from "../cost-band";

describe("costBand", () => {
  it("puts a price in its band, with each bound in the band above", () => {
    expect([0, 1, 499, 500, 1499, 1500, 2999, 3000, 12000].map(costBand)).toEqual([
      "free", "under500", "under500", "to1500", "to1500", "to3000", "to3000", "over3000", "over3000",
    ]);
  });

  it("has no band without a price on record", () => {
    expect(costBand(null)).toBeNull();
    expect(costBandWords(undefined)).toBeNull();
  });

  it("only moves when a price jumps a band", () => {
    // Shukkei-en went from ¥260 to ¥350: same band, nothing to fix.
    expect(costBandWords(260)).toBe(costBandWords(350));
    // Osaka Castle went from ¥600 to ¥1,200: same band too.
    expect(costBandWords(600)).toBe("¥500–1,500");
    expect(costBandWords(1200)).toBe("¥500–1,500");
    // Hōryū-ji went from ¥1,500 to ¥2,000; Tsūtenkaku from ¥900 to ¥1,500.
    expect(costBandWords(900)).not.toBe(costBandWords(1500));
  });
});
