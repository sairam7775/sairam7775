import type { RouteLegAssessment } from "@/lib/engine/route";

/** The trains of each move, keyed by the date you arrive where you'll sleep
 *  next: that is the travel day. A day trip there and back has no fixed
 *  date, and a stay with no date yet has no travel day, so neither appears. */
export function travelDays<L extends Pick<RouteLegAssessment, "movingTo">>(
  cities: { cityId: string; arriveDate: string | null }[],
  legs: L[],
): Map<string, L[]> {
  const arrive = new Map(cities.map((c) => [c.cityId, c.arriveDate]));
  const out = new Map<string, L[]>();
  for (const l of legs) {
    const date = l.movingTo ? arrive.get(l.movingTo) : null;
    if (!date) continue;
    out.set(date, [...(out.get(date) ?? []), l]);
  }
  return out;
}

/** A travel day's trains in the order of the day: the ride to the day's
 *  city before its stops, and a ride on out of it (Himeji, then on to
 *  Hiroshima that evening) after them, never beside the morning's. */
export function travelDayParts<L extends Pick<RouteLegAssessment, "fromCityId">>(legs: L[], dayCityId: string): { there: L[]; onward: L[] } {
  return { there: legs.filter((l) => l.fromCityId !== dayCityId), onward: legs.filter((l) => l.fromCityId === dayCityId) };
}
