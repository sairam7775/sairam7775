import { describe, expect, it } from "vitest";
import type { CoverageTier } from "@/lib/types";
import { READY_MADE_CITIES } from "../ready-made/types";
import { readyMadeForNights } from "../ready-made/suggest";

const allPlanned = new Map<string, CoverageTier>(READY_MADE_CITIES.map((id) => [id, "outline"]));
const withStub = (...ids: string[]) => new Map([...allPlanned].map(([id, t]) => [id, ids.includes(id) ? "stub" : t] as [string, CoverageTier]));
const ids = (r: ReturnType<typeof readyMadeForNights>) => r.trips.map((t) => t.id);

describe("readyMadeForNights", () => {
  it("matches N nights to the trips of N + 1 days", () => {
    const r = readyMadeForNights(6, allPlanned);
    expect(ids(r)).toEqual(["classic-7", "kansai-hiroshima-7"]);
    expect(r.exact).toBe(true);
    expect(ids(readyMadeForNights(4, allPlanned))).toEqual(["tokyo-kamakura-yokohama-5", "osaka-kyoto-nara-5"]);
    expect(ids(readyMadeForNights(13, allPlanned))).toEqual(["all-nine-14"]);
  });

  it("falls back to trips of N days, one night shorter, when no trip has N + 1", () => {
    // "A week" may come in as seven nights.
    const r = readyMadeForNights(7, allPlanned);
    expect(ids(r)).toEqual(["classic-7", "kansai-hiroshima-7"]);
    expect(r.exact).toBe(false);
    expect(ids(readyMadeForNights(14, allPlanned))).toEqual(["all-nine-14"]);
  });

  it("prefers a trip of N + 1 days over one of N days", () => {
    // Four nights: the 5-day trips, not the 3-day ones (nor any 4-day one).
    expect(readyMadeForNights(4, allPlanned).trips.every((t) => t.days === 5)).toBe(true);
    // Two nights: 3-day trips exist, so the 2-day ones aren't offered.
    expect(readyMadeForNights(2, allPlanned).trips.every((t) => t.days === 3)).toBe(true);
  });

  it("offers nothing for a length with no trip either way", () => {
    expect(readyMadeForNights(8, allPlanned).trips).toEqual([]);
    expect(readyMadeForNights(20, allPlanned).trips).toEqual([]);
  });

  it("never offers a trip through a city that isn't planned, day trips included", () => {
    expect(ids(readyMadeForNights(6, withStub("tokyo-city")))).toEqual(["kansai-hiroshima-7"]);
    // Himeji is only a day trip on the Kansai week.
    expect(ids(readyMadeForNights(6, withStub("tokyo-city", "himeji")))).toEqual([]);
    expect(ids(readyMadeForNights(13, withStub("kamakura")))).toEqual([]);
    // A city the store doesn't list counts as not planned.
    const missing = new Map(allPlanned);
    missing.delete("nara-city");
    expect(ids(readyMadeForNights(4, missing))).toEqual(["tokyo-kamakura-yokohama-5"]);
  });

  it("falls back only among the trips that may be offered", () => {
    expect(ids(readyMadeForNights(7, withStub("tokyo-city")))).toEqual(["kansai-hiroshima-7"]);
    // Three nights: no 4-day trip, so the 3-day ones, one night shorter.
    const r = readyMadeForNights(3, withStub("tokyo-city"));
    expect(ids(r)).toEqual(["kyoto-nara-3"]);
    expect(r.exact).toBe(false);
  });
});
