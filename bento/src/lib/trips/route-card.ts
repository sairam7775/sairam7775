import type { CoverageTier } from "@/lib/types";

/** What a route proposal shows besides its cities: the trains, with a day
 *  trip's way back folded into one row, and the places you sleep that
 *  Bento can't plan days in yet. Plain functions, so they can be tested. */

interface Leg {
  fromCityId: string;
  toCityId: string;
  movingTo: string | null;
  summary: string;
  lines: string[];
}

export function trainRows(legs: Leg[]): { summary: string; lines: string[]; back: boolean }[] {
  const rows: { summary: string; lines: string[]; back: boolean }[] = [];
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    const n = legs[i + 1];
    const back = l.movingTo === null && n != null && n.movingTo === null && n.fromCityId === l.toCityId && n.toCityId === l.fromCityId;
    rows.push({ summary: l.summary, lines: l.lines, back });
    if (back) i++;
  }
  return rows;
}

/** Per city when the route mixes how well Bento knows its stops; once for
 *  the whole route when they are all the same, rather than the same
 *  sentence under every city. */
export function coverageShown(cities: { tier: CoverageTier }[]): { perCity: boolean; everywhere: CoverageTier | null } {
  const tiers = new Set(cities.map((c) => c.tier));
  return tiers.size === 1 ? { perCity: false, everywhere: [...tiers][0] } : { perCity: true, everywhere: null };
}

export function uncoveredStays(cities: { name: string; nights: number; tier: CoverageTier }[]): { names: string[]; all: boolean } {
  const stays = cities.filter((c) => c.nights > 0);
  const names = stays.filter((c) => c.tier === "stub").map((c) => c.name);
  return { names, all: names.length > 0 && names.length === stays.length };
}
