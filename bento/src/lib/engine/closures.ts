/** Closures on dates that come round every year, such as Japan's year-end
 *  break. Stored as month-day ranges, "MM-DD..MM-DD" (or one "MM-DD"), in
 *  `places.closed_yearly`; a range whose end is before its start wraps the
 *  year ("12-28..01-01" is 28 Dec to 1 Jan). Pure: no clock, no network. */
import { copy } from "@/copy";

const MD = "(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])";
const SHAPE = new RegExp(`^${MD}(\\.\\.${MD})?$`);
// The longest each month can be, February in a leap year.
const DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const realDay = (md: string) => DAYS[Number(md.slice(0, 2)) - 1] >= Number(md.slice(3, 5));

/** True for "MM-DD" or "MM-DD..MM-DD" with real months and days. */
export function isYearlyRange(s: string): boolean {
  if (!SHAPE.test(s)) return false;
  return s.split("..").every(realDay);
}

const ends = (range: string): [string, string] => {
  const [from, to] = range.split("..");
  return [from, to ?? from];
};

/** The range that closes the place on this "YYYY-MM-DD" date, or null. */
export function closedYearlyOn(p: { closedYearly?: readonly string[] }, date: string): string | null {
  const md = date.slice(5, 10);
  for (const range of p.closedYearly ?? []) {
    const [from, to] = ends(range);
    const inside = from <= to ? md >= from && md <= to : md >= from || md <= to;
    if (inside) return range;
  }
  return null;
}

// A leap year, so 29 Feb can be written.
const dayWords = (md: string) =>
  new Date(`2000-${md}T00:00:00Z`).toLocaleDateString(copy.locale, { day: "numeric", month: "short", timeZone: "UTC" });

/** "12-28..01-01" → "28 Dec – 1 Jan"; "01-01" → "1 Jan". */
export function yearlyRangeWords(range: string): string {
  const [from, to] = ends(range);
  return from === to ? dayWords(from) : copy.plan.dates.range(dayWords(from), dayWords(to));
}
