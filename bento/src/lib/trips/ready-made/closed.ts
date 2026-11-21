/** Which of a ready-made trip's must-see places a start date puts on a day
 *  they are closed: that weekday, a one-off closed date, or a date they
 *  close every year (`closedYearlyOn`). The owner's rule (21 Nov 2026): such
 *  a start is refused, by the picker before anything is written and by
 *  `suggest_route` for a trip with dates, rather than planned with a
 *  warning. Pure: no clock, no database.
 *
 *  The weekday starts in `ready-made.test.ts` already keep every must-see off
 *  its weekly closing day, so in practice this finds year-end closures; the
 *  weekday and one-off checks are there so no closure is missed. */
import { closedYearlyOn, yearlyRangeWords } from "@/lib/engine/closures";
import { copy } from "@/copy";
import { readyMadeToPlan } from "./to-plan";
import type { ReadyMadeTrip } from "./types";

/** What this check reads of a place: a `PlaceInput` or a seed record. */
export interface ClosingFacts {
  name: string;
  closedWeekdays?: readonly number[];
  closedDates?: readonly string[];
  closedYearly?: readonly string[];
}

export interface ClosedMustSee {
  placeId: string;
  name: string;
  /** 1 = the first day. */
  day: number;
  /** "YYYY-MM-DD", the day this start puts it on. */
  date: string;
  why: { kind: "weekly"; weekday: number } | { kind: "date" } | { kind: "yearly"; range: string };
}

/** Every must-see closed on its day for this start, in day order. A
 *  must-see `places` doesn't hold is skipped: the catalogue check refuses
 *  that start on its own. */
export function closedMustSees(trip: ReadyMadeTrip, startDate: string, places: ReadonlyMap<string, ClosingFacts>): ClosedMustSee[] {
  const out: ClosedMustSee[] = [];
  readyMadeToPlan(trip, startDate).days.forEach((d, i) => {
    const weekday = new Date(`${d.date}T00:00:00Z`).getUTCDay();
    for (const { placeId } of d.locked ?? []) {
      const p = places.get(placeId);
      if (!p) continue;
      const yearly = closedYearlyOn(p, d.date);
      const why: ClosedMustSee["why"] | null = p.closedWeekdays?.includes(weekday)
        ? { kind: "weekly", weekday }
        : p.closedDates?.includes(d.date)
          ? { kind: "date" }
          : yearly
            ? { kind: "yearly", range: yearly }
            : null;
      if (why) out.push({ placeId, name: p.name, day: i + 1, date: d.date, why });
    }
  });
  return out;
}

const WEEKDAY = copy.plan.weekdays as Record<number, string>;
const dayWords = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** The picker's refusal: the place, its closure, the day, and to pick
 *  another first day. */
export function closedMustSeeWords(c: ClosedMustSee): string {
  const e = copy.readyMade.picker.errors;
  const day = dayWords(c.date);
  if (c.why.kind === "weekly") return e.closedWeekly(c.name, WEEKDAY[c.why.weekday], day);
  if (c.why.kind === "date") return e.closedDate(c.name, day);
  return e.closedYearly(c.name, yearlyRangeWords(c.why.range), day);
}
