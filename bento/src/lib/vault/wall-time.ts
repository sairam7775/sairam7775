/** A local date, optionally with a time: what a datetime-local field sends. */
const WALL_TIME = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

/** True for a real calendar date (and, if given, a real clock time).
 *  Rejects shapes that parse oddly (`2026-02-30`, `2026-11-20T25:00`). */
export function isWallTime(v: string): boolean {
  if (!WALL_TIME.test(v)) return false;
  const [date, time] = v.split("T");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  if (time) {
    const [h, m, s = "00"] = time.split(":");
    if (Number(h) > 23 || Number(m) > 59 || Number(s) > 59) return false;
  }
  return true;
}

/** Booking times are wall-clock times at the place, stored as if UTC: every
 *  reader slices the date or formats in UTC (`dayOf`, the vault list). So a
 *  2am check-in on the 21st must be stored as 21st 02:00Z — not converted
 *  through whatever timezone this server runs in, which put it on the 20th. */
export function stamp(s: string | undefined): string | null {
  if (!s) return null;
  const [date, time = "00:00"] = s.split("T");
  return new Date(`${date}T${time.length === 5 ? `${time}:00` : time}Z`).toISOString();
}
