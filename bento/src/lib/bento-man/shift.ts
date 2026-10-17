import { bookingHoldsPlace } from "@/lib/vault/match";
import type { TicketLike } from "@/lib/vault/match";
import type { PlaceInput } from "@/lib/engine/types";
import { shiftDate, type DayRow, type TripCityRow } from "./store";
import { copy } from "@/copy";

const WEEKDAY = copy.plan.weekdays as Record<number, string>;
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** What moving the trip's dates would break in the days already planned.
 *
 *  Planned days travel with the start date, but a stop's opening days and
 *  the traveller's tickets do not: a Sunday plan moved one day puts a
 *  Monday-closed temple on a Monday, and a ticket for the 21st does not
 *  follow the day to the 22nd. Returns one sentence per problem; empty
 *  means the move is safe. */
export function shiftConflicts(
  days: Pick<DayRow, "date" | "items">[],
  placesById: Map<string, PlaceInput>,
  bookings: TicketLike[],
  shift: number,
): string[] {
  if (!shift) return [];
  const out: string[] = [];
  for (const d of days) {
    const to = shiftDate(d.date, shift);
    const weekday = new Date(`${to}T00:00:00Z`).getUTCDay();
    for (const it of d.items) {
      const p = placesById.get(it.placeId);
      if (!p) continue;
      if (p.closedWeekdays.includes(weekday)) out.push(copy.plan.dates.closedOn(p.name, WEEKDAY[weekday], fmt(to)));
      else if (p.closedDates.includes(to)) out.push(copy.plan.dates.closedDate(p.name, fmt(to)));
      else if (p.bookingReq === "required" && !bookings.some((b) => bookingHoldsPlace(b, p, to))) {
        out.push(copy.plan.dates.noTicket(p.name, fmt(to)));
      }
    }
  }
  return out;
}

export function shiftRefusal(conflicts: string[]): string {
  return copy.plan.dates.breaks(conflicts.slice(0, 4).join(copy.plan.dates.conflictJoin), Math.max(0, conflicts.length - 4));
}

/** Dates of planned days that no longer belong to the route laid on the
 *  calendar: their city was dropped, or the route was reordered so another
 *  city now owns that date. The SQL in 0015 (`apply_proposal`) does the same
 *  for the database; this is the in-memory twin, so the tests exercise one rule. */
export function staleDayDates(days: Pick<DayRow, "date" | "cityId">[], cities: Pick<TripCityRow, "cityId" | "arriveDate" | "departDate">[]): string[] {
  const lastDepart = cities.reduce<string | null>((m, c) => (c.departDate && (!m || c.departDate > m) ? c.departDate : m), null);
  return days
    .filter((d) => d.cityId)
    .filter((d) => !cities.some((c) => {
      if (c.cityId !== d.cityId) return false;
      if (!c.arriveDate || !c.departDate) return true;
      return d.date >= c.arriveDate && (d.date < c.departDate || (d.date === c.departDate && c.departDate === lastDepart));
    }))
    .map((d) => d.date);
}
