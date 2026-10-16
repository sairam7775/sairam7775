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
  /** "accommodation" is a stay: its check-in and check-out are moments. */
  type?: string;
  /** ISO timestamp, wall time stored as UTC. */
  startsAt: string | null;
  endsAt: string | null;
  /** False when only a date was given (0018): that end has no time, so it
   *  is untimed on its day, never 00:00. Missing means known. */
  startTimeKnown?: boolean;
  endTimeKnown?: boolean;
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

/** Where a booking sits in the box for `date`, and the time it takes up.
 *
 *  Shown: from its start time on the day it starts; at its end time on the
 *  day it ends (a check-out, a landing); all day on a day in between.
 *  `endMin` is only set when it starts and ends that same day.
 *
 *  Busy (for clashes): the booked interval on a same-day booking. One that
 *  runs past midnight — a 23:00 flight landing at 01:00 — is busy for the
 *  rest of its first day and the start of its last; a journey (a flight or
 *  transport) is busy all of any day in between, on a two-night ferry, say.
 *  A stay is never busy: check-in and check-out are moments, and the nights
 *  between are free. Nor is a multi-day pass or ticket between its ends.
 *  A time marked unknown (a date with no time) is untimed on its day: shown
 *  without a clock, and busy for nothing, since we don't know when. 00:00
 *  with a known time is a real midnight. */
export function bookingSlot(b: PlannableBooking, date: string): {
  startMin: number | null;
  endMin: number | null;
  part: "starts" | "ends" | "all-day";
  busy: { from: number; to: number } | null;
} {
  const range = bookingDates(b);
  const none = { startMin: null, endMin: null, part: "all-day" as const, busy: null };
  if (!range || !canPlanOn(b, date)) return none;
  const stay = b.type === "accommodation";
  const startMin = b.startTimeKnown === false ? null : minuteOf(b.startsAt!);
  const endMin = b.endsAt && b.endTimeKnown !== false ? minuteOf(b.endsAt) : null;
  const overnight = range.first !== range.last;
  if (date === range.first) {
    if (startMin == null) return { startMin: null, endMin: null, part: "starts", busy: null };
    if (!overnight) {
      const end = endMin != null && endMin > startMin ? endMin : null;
      return { startMin, endMin: end, part: "starts", busy: end != null && !stay ? { from: startMin, to: end } : null };
    }
    return { startMin, endMin: null, part: "starts", busy: stay ? null : { from: startMin, to: 24 * 60 } };
  }
  if (date === range.last && b.endsAt) {
    if (endMin == null) return { startMin: null, endMin: null, part: "ends", busy: null };
    return { startMin: endMin, endMin: null, part: "ends", busy: stay || endMin === 0 ? null : { from: 0, to: endMin } };
  }
  const journey = b.type === "flight" || b.type === "transport";
  return journey ? { ...none, busy: { from: 0, to: 24 * 60 } } : none;
}

/** The planned bookings a stop clashes with on `date`: every booking in
 *  the plan that covers the date, whether it has a time there or is busy all
 *  day (the middle of a journey). What the day box flags. */
export function clashingBookings<B extends PlannableBooking & { plannedOn: string | null }>(
  stop: { startMin: number | null; durationMin: number | null },
  bookings: B[],
  date: string,
): B[] {
  return bookings.filter((b) => b.plannedOn != null && canPlanOn(b, date) && clashes(stop, bookingSlot(b, date)));
}

/** Does a planned stop (start + duration, minutes from midnight) clash with
 *  a booking? With a busy interval, any overlap. Without one (a check-in, a
 *  booking with no end) it is a moment, and a stop clashes if it is still
 *  going on then. An all-day slot clashes with nothing. */
export function clashes(
  stop: { startMin: number | null; durationMin: number | null },
  slot: { startMin: number | null; busy?: { from: number; to: number } | null },
): boolean {
  if (stop.startMin == null) return false;
  const stopEnd = stop.startMin + (stop.durationMin ?? 60);
  if (slot.busy) return stop.startMin < slot.busy.to && slot.busy.from < stopEnd;
  if (slot.startMin == null) return false;
  return stop.startMin <= slot.startMin && slot.startMin < stopEnd;
}
