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

type TrainRow = { summary: string; lines: string[]; back: { summary: string; lines: string[] } | null };

/** One row per journey; a day trip's way back rides in its row with its
 *  own summary and lines, since it can be a different service. */
export function trainRows(legs: Leg[]): TrainRow[] {
  const rows: TrainRow[] = [];
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    const n = legs[i + 1];
    const folds = l.movingTo === null && n != null && n.movingTo === null && n.fromCityId === l.toCityId && n.toCityId === l.fromCityId;
    rows.push({ summary: l.summary, lines: l.lines, back: folds ? { summary: n.summary, lines: n.lines } : null });
    if (folds) i++;
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

/** Whether Bento's train data has any journey on this route: a leg it can't
 *  route (outside the corridor) or a route with no legs at all has none, so
 *  the card mustn't promise trains for it. */
export function hasKnownTrains(legs: Pick<Leg, "lines">[] | undefined): boolean {
  return (legs ?? []).some((l) => l.lines.length > 0);
}

/** The one coverage line for a route whose stops are all known equally well,
 *  or null. Not covered anywhere is already said by the note above Accept
 *  when the route has places to sleep; a route of day trips only has no
 *  note, so it gets the line instead. */
export function routeWideCoverage(cities: { name: string; nights: number; tier: CoverageTier }[]): CoverageTier | null {
  const { everywhere } = coverageShown(cities);
  if (everywhere !== "stub") return everywhere;
  return uncoveredStays(cities).names.length ? null : "stub";
}

/** The places you sleep that Bento can't plan days in yet. `all` only when
 *  no stop on the route can be planned, day trips included, so the card
 *  never says "any of these places" beside a stop that can. */
export function uncoveredStays(cities: { name: string; nights: number; tier: CoverageTier }[]): { names: string[]; all: boolean } {
  const names = cities.filter((c) => c.nights > 0 && c.tier === "stub").map((c) => c.name);
  return { names, all: names.length > 0 && cities.every((c) => c.tier === "stub") };
}
