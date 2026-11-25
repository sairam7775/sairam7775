import { describe, expect, it } from "vitest";
import { searchPlaces, simplifyName } from "./place-search";

const list = [
  { id: "a", name: "Fushimi Inari Taisha", nameJa: "伏見稲荷大社" },
  { id: "b", name: "Kiyomizu-dera", nameJa: "清水寺" },
  { id: "c", name: "Tōdai-ji", nameJa: "東大寺" },
  { id: "d", name: "Ninenzaka & Sannenzaka", nameJa: null },
  { id: "e", name: "Gion", nameJa: "祇園", onDay: true },
  { id: "f", name: "Hanamikoji in Gion", nameJa: null },
];
const ids = (q: string) => searchPlaces(list, q).map((p) => p.id);

describe("searchPlaces", () => {
  it("ignores case, accents, hyphens and spaces", () => {
    expect(simplifyName("Tōdai-ji")).toBe("todaiji");
    expect(ids("todaiji")).toEqual(["c"]);
    expect(ids("KIYOMIZU dera")).toEqual(["b"]);
  });

  it("finds the Japanese name too", () => {
    expect(ids("清水")).toEqual(["b"]);
  });

  it("every word must match, in any order", () => {
    expect(ids("inari fushimi")).toEqual(["a"]);
    expect(ids("inari kyoto")).toEqual([]);
  });

  it("a name starting with the query comes first; places on the day go last", () => {
    expect(ids("sannen")).toEqual(["d"]);
    expect(ids("gion")).toEqual(["f", "e"]);
  });

  it("an empty query keeps the list, the day's own stops last", () => {
    expect(ids("  ")).toEqual(["a", "b", "c", "d", "f", "e"]);
  });
});
