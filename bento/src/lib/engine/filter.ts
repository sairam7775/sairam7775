import { chooseDuration, HARD_MOBILITY } from "./score";
import type { PlaceInput, Rejected, TravellerInput } from "./types";
import { copy } from "@/copy";

const WEEKDAY = copy.plan.weekdays as Record<number, string>;

/** Words people use for a category, mapped to the stored one. */
const ALIAS: Record<string, string> = {
  hiking: "hike",
  trek: "hike",
  trekking: "hike",
  hot_spring: "onsen",
};

/** One spelling for an exclude, a category or a tag: lower case, spaces and
 *  hyphens as underscores, simple plurals made singular, common synonyms
 *  mapped. "Beaches" → "beach", "Hot springs" → "onsen", "hiking" → "hike". */
export function normaliseTerm(x: string): string {
  let s = x.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (s.endsWith("ies")) s = `${s.slice(0, -3)}y`;
  else if (/(ch|sh|ss|x)es$/.test(s)) s = s.slice(0, -2);
  else if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
  return ALIAS[s] ?? s;
}

export interface FilterContext {
  date: string;
  weekday: number;
  bookedPlaceIds: Set<string>;
  usedPlaceIds: Set<string>;
}

/** Scheduler step 2: hard constraints. No scoring, no exceptions. A place
 *  that fails here is never ranked — it is reported with the rule that
 *  removed it, because "why isn't X in my plan" deserves an answer. */
export function hardFilter(p: PlaceInput, t: TravellerInput, ctx: FilterContext): Rejected | null {
  const reject = (term: string, detail: string): Rejected => ({ placeId: p.id, name: p.name, stage: "filter", term, detail });

  if (p.coverageTier === "stub") {
    return reject("coverage", "I don't know this place well enough yet to plan around it");
  }
  if (p.verificationStatus !== "verified") {
    return reject("unverified", "nobody has checked this record yet, so I won't plan on it");
  }
  if (chooseDuration(p, t.pace) == null) {
    return reject("no_duration", "no verified duration on record");
  }

  // Excludes match the category, the tags, and what the place demands —
  // compared as normalised words, because "no beaches" is said in plurals
  // and capitals and stored categories are singular ("beach", "hike").
  const demands = new Set([p.category, ...p.interestTags, ...((p.energy ?? 0) >= 0.75 ? ["hiking"] : [])].map(normaliseTerm));
  const excluded = t.excludes.find((x) => demands.has(normaliseTerm(x)));
  if (excluded) {
    return reject("excluded", copy.plan.leftOut.excluded(excluded));
  }

  const need = t.mobility.find((m) => HARD_MOBILITY.has(m) && p.skipIf.includes(m));
  if (need) {
    return reject("not_suitable", copy.plan.leftOut.notSuitable(need.replace(/_/g, " ")));
  }

  if (p.closedWeekdays.includes(ctx.weekday)) {
    return reject("closed", copy.plan.leftOut.closed(WEEKDAY[ctx.weekday]));
  }
  if (p.closedDates.includes(ctx.date)) {
    return reject("closed", copy.plan.leftOut.closedDate);
  }

  if (p.bookingReq === "required" && !ctx.bookedPlaceIds.has(p.id)) {
    return reject("booking_required", copy.plan.leftOut.needsTicket(p.bookingLeadDays ?? null));
  }

  if (ctx.usedPlaceIds.has(p.id)) {
    return reject("already_planned", "already in the trip on another day");
  }

  return null;
}

/** Minutes since midnight from "HH:MM", or null. */
export function parseClock(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** "before 08:00" → { before: 480 }; "after 17:30" → { after: 1050 }. */
export function parseWindow(win: string): { before?: number; after?: number } {
  const m = /^(before|after)\s+(\d{1,2}:\d{2})/i.exec(win.trim());
  if (!m) return {};
  const at = parseClock(m[2])!;
  return m[1].toLowerCase() === "before" ? { before: at } : { after: at };
}
