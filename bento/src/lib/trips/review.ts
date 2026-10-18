/** "How did the plan hold up?" — asked once a trip has ended (0019).
 *
 *  Pure: what may be answered, when the question is open, and reading a
 *  submitted form. The keys match the check constraints in 0019; the words
 *  for them are in copy.review. */
import { z } from "zod";
import { copy } from "@/copy";

export const OUTCOMES = ["as_planned", "mostly", "not_really"] as const;
export const CHALLENGES = ["too_much", "travel_longer", "place_closed", "crowds", "booking", "walking", "timing", "other"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type Challenge = (typeof CHALLENGES)[number];

export const NOTE_MAX = 2000;

export interface TripReview {
  outcome: Outcome;
  challenges: Challenge[];
  /** "YYYY-MM-DD", inside the trip's dates. */
  hardDays: string[];
  note: string | null;
}

/** Open from the trip's last day on (dates are compared as UTC dates, like
 *  the database's current_date), and only if there was a plan to follow. */
export function reviewOpen(trip: { endDate: string | null }, hasPlan: boolean, today: string): boolean {
  return Boolean(trip.endDate && trip.endDate <= today && hasPlan);
}

const Form = z.object({
  outcome: z.enum(OUTCOMES, { message: copy.review.errors.outcome }),
  challenges: z.array(z.enum(CHALLENGES)),
  hardDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  note: z.string().max(NOTE_MAX, copy.review.errors.noteTooLong(NOTE_MAX)),
});

export function parseReview(form: FormData, trip: { startDate: string | null; endDate: string | null }): { ok: true; review: TripReview } | { ok: false; error: string } {
  const p = Form.safeParse({
    outcome: form.get("outcome") ?? undefined,
    challenges: [...new Set(form.getAll("challenge").map(String))],
    hardDays: [...new Set(form.getAll("hardDay").map(String))].sort(),
    note: String(form.get("note") ?? "").trim(),
  });
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const { startDate, endDate } = trip;
  if (p.data.hardDays.some((d) => !startDate || !endDate || d < startDate || d > endDate)) return { ok: false, error: copy.review.errors.dayOutside };
  return { ok: true, review: { outcome: p.data.outcome, challenges: p.data.challenges, hardDays: p.data.hardDays, note: p.data.note || null } };
}

/** A stored row as the app reads it; anything unexpected is dropped rather
 *  than shown. */
export function reviewFromRow(row: { outcome: string; challenges: string[] | null; hard_days: string[] | null; note: string | null } | null): TripReview | null {
  if (!row || !(OUTCOMES as readonly string[]).includes(row.outcome)) return null;
  return {
    outcome: row.outcome as Outcome,
    challenges: (row.challenges ?? []).filter((c): c is Challenge => (CHALLENGES as readonly string[]).includes(c)),
    hardDays: row.hard_days ?? [],
    note: row.note,
  };
}
