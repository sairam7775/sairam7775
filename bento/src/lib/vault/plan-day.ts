/** Which day of the plan a booking may sit on, and where in it.
 *
 *  A booking sits in a day's box as a fixed block (`bookings.planned_on`).
 *  It may only go on a date it covers — the day it starts, the day it ends,
 *  or a day between — so a dinner on the 6th can never land in the 5th's
 *  box. The database enforces the same rule (0017); this is the copy the
 *  UI and the actions use to say no before writing.
 *
 *  Times are wall-clock at the place stored as if UTC (`wall-time.ts`), so
 *  every date and clock here is read in UTC. */

export interface PlannableBooking {
  /** ISO timestamp, wall time stored as UTC. */
  startsAt: string | null;
  endsAt: string | null;
}

const dateOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const minuteOf = (iso: string) => {
  const d = new Date(iso);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

/** The first and last date a booking covers, or null if it has no date. */
export function bookingDates(b: PlannableBooking): { first: string; last: string } | null {
  if (!b.startsAt) return null;
  const first = dateOf(b.startsAt);
  const last = b.endsAt && dateOf(b.endsAt) > first ? dateOf(b.endsAt) : first;
  return { first, last };
}

/** May this booking sit in the box for `date` ("YYYY-MM-DD")? */
export function canPlanOn(b: PlannableBooking, date: string): boolean {
  const range = bookingDates(b);
  return range != null && date >= range.first && date <= range.last;
}

/** Where a booking sits in the box for `date`: from its start time on the
 *  day it starts, at its end time on the day it ends (a check-out, a
 *  landing), and all day on a day in between. A time of exactly 00:00 is a
 *  booking entered with a date and no time, so it is all day too.
 *  `endMin` is only set when the booking starts and ends that same day. */
export function bookingSlot(b: PlannableBooking, date: string): { startMin: number | null; endMin: number | null; part: "starts" | "ends" | "all-day" } {
  const range = bookingDates(b);
  if (!range || !canPlanOn(b, date)) return { startMin: null, endMin: null, part: "all-day" };
  const timed = (iso: string) => (minuteOf(iso) === 0 ? null : minuteOf(iso));
  if (date === range.first) {
    const startMin = timed(b.startsAt!);
    const end = startMin != null && b.endsAt && dateOf(b.endsAt) === date ? timed(b.endsAt) : null;
    return { startMin, endMin: end != null && startMin != null && end > startMin ? end : null, part: startMin == null ? "all-day" : "starts" };
  }
  if (date === range.last && b.endsAt) {
    const endMin = timed(b.endsAt);
    return { startMin: endMin, endMin: null, part: endMin == null ? "all-day" : "ends" };
  }
  return { startMin: null, endMin: null, part: "all-day" };
}

/** Does a planned stop (start + duration, minutes from midnight) clash with
 *  a booking's slot? A booking with no end is a moment: a stop clashes if
 *  it is still going on then. An all-day booking clashes with nothing. */
export function clashes(stop: { startMin: number | null; durationMin: number | null }, slot: { startMin: number | null; endMin: number | null }): boolean {
  if (stop.startMin == null || slot.startMin == null) return false;
  const stopEnd = stop.startMin + (stop.durationMin ?? 60);
  if (slot.endMin == null) return stop.startMin <= slot.startMin && slot.startMin < stopEnd;
  return stop.startMin < slot.endMin && slot.startMin < stopEnd;
}
