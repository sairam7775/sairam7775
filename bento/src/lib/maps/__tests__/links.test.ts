import { describe, expect, it } from "vitest";
import { journeyMapUrl, placeMapUrl } from "../links";

describe("placeMapUrl", () => {
  it("uses a Japanese place name with its city when one is available", () => {
    expect(placeMapUrl({ name: "Himeji Castle", nameJa: "姫路城", cityName: "Himeji" })).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("姫路城, Himeji")}`,
    );
  });

  it("uses the English name, city and Japan when there is no Japanese name", () => {
    expect(placeMapUrl({ name: "Himeji Castle", cityName: "Himeji" })).toBe(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Himeji Castle, Himeji, Japan")}`,
    );
  });

  it("encodes reserved query characters", () => {
    const url = placeMapUrl({ name: "Castle & garden + museum", cityName: "Himeji" });
    expect(url).toContain(encodeURIComponent("Castle & garden + museum, Himeji, Japan"));
    expect(url).not.toContain("Castle & garden + museum");
  });
});

describe("journeyMapUrl", () => {
  it("uses station coordinates when both ends have them", () => {
    expect(journeyMapUrl({
      from: { name: "Kyoto", lat: 34.9858, lon: 135.7588 },
      to: { name: "Hiroshima", lat: 34.3973, lon: 132.4753 },
    })).toBe("https://www.google.com/maps/dir/?api=1&origin=34.9858%2C135.7588&destination=34.3973%2C132.4753&travelmode=transit");
  });

  it("uses station names with Japan when coordinates are absent, without doubling Station", () => {
    const url = journeyMapUrl({ from: { name: "Kyoto Station" }, to: { name: "Hiroshima" } });
    expect(url).toBe(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent("Kyoto Station, Japan")}&destination=${encodeURIComponent("Hiroshima Station, Japan")}&travelmode=transit`,
    );
  });
});
