import { bookingHoldsPlace } from "@/lib/vault/match";
import type { TicketLike } from "@/lib/vault/match";
import type { PlaceInput } from "@/lib/engine/types";
import { shiftDate, type DayRow, type TripCityRow } from "./store";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

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
      if (p.closedWeekdays.includes(weekday)) out.push(`${p.name} is closed on ${WEEKDAY[weekday]}s, and would land on ${fmt(to)}`);
      else if (p.closedDates.includes(to)) out.push(`${p.name} is closed on ${fmt(to)}`);
      else if (p.bookingReq === "required" && !bookings.some((b) => bookingHoldsPlace(b, p, to))) {
        out.push(`${p.name} needs a ticket, and none is recorded for ${fmt(to)}`);
      }
    }
  }
  return out;
}

export function shiftRefusal(conflicts: string[]): string {
  const shown = conflicts.slice(0, 4).join("; ");
  const more = conflicts.length > 4 ? `; and ${conflicts.length - 4} more` : "";
  return `Moving the dates would break your day plans: ${shown}${more}. Re-plan or clear those days first, then change the dates.`;
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
