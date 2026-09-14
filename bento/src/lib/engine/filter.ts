import { chooseDuration, HARD_MOBILITY } from "./score";
import type { PlaceInput, Rejected, TravellerInput } from "./types";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

  // Excludes match the category, the tags, and what the place demands.
  const demands = [p.category, ...p.interestTags, ...((p.energy ?? 0) >= 0.75 ? ["hiking"] : [])];
  const excluded = t.excludes.find((x) => demands.includes(x));
  if (excluded) {
    return reject("excluded", `you said never: ${excluded}`);
  }

  const need = t.mobility.find((m) => HARD_MOBILITY.has(m) && p.skipIf.includes(m));
  if (need) {
    return reject("not_suitable", `marked as one to skip for ${need.replace(/_/g, " ")}`);
  }

  if (p.closedWeekdays.includes(ctx.weekday)) {
    return reject("closed", `closed on ${WEEKDAY[ctx.weekday]}s`);
  }
  if (p.closedDates.includes(ctx.date)) {
    return reject("closed", "closed on this date");
  }

  if (p.bookingReq === "required" && !ctx.bookedPlaceIds.has(p.id)) {
    const lead = p.bookingLeadDays ? ` about ${p.bookingLeadDays} days ahead` : "";
    return reject("booking_required", `needs a ticket booked${lead} — none recorded`);
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
