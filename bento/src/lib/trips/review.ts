/** "How did the plan hold up?" — asked once a trip has ended (0019).
 *
 *  Pure: what may be answered, when the question is open, and reading a
 *  submitted form. The keys match the check constraints in 0019; the words
 *  for them are in copy.review. */
import { z } from "zod";
import { copy } from "@/copy";
import { allocateDates } from "@/lib/engine/route";

export const OUTCOMES = ["as_planned", "mostly", "not_really"] as const;
export const CHALLENGES = ["too_much", "travel_longer", "place_closed", "crowds", "booking", "walking", "timing", "other"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type Challenge = (typeof CHALLENGES)[number];

export const NOTE_MAX = 2000;
/** The most hard days one answer keeps (0019's check). */
export const HARD_DAYS_MAX = 60;

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
  hardDays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(HARD_DAYS_MAX, copy.review.errors.tooManyDays(HARD_DAYS_MAX)),
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

/** The plan as it stood when the traveller first answered. The database
 *  makes it (0019's trip_reviews_plan trigger) and keeps it, because the
 *  trip can change afterwards (new dates shift every day; a re-plan swaps
 *  the stops), and an answer is about the plan they followed. This is its
 *  shape, for reading it back. */
export const PlanSnapshotSchema = z.object({
  /** The trip's dates then: the days an answer's hard days are chosen from. */
  start: z.string().nullable(),
  end: z.string().nullable(),
  party: z.number(),
  route: z.array(z.object({ city: z.string(), nights: z.number() })),
  days: z.array(z.object({
    date: z.string(),
    city: z.string().nullable(),
    stops: z.array(z.object({ time: z.string().nullable(), name: z.string() })),
  })),
});
export type PlanSnapshot = z.infer<typeof PlanSnapshotSchema>;

/** Every date from start to end, inclusive ("YYYY-MM-DD", read as UTC). */
export function datesBetween(start: string | null, end: string | null): string[] {
  if (!start || !end || end < start) return [];
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`) && out.length < 400; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** The city of each date in a saved plan: the route's nights laid over the
 *  dates as the trip page lays them, then each planned day's own city. A
 *  day with no stops (arriving, leaving) still has one. */
export function snapshotCities(plan: PlanSnapshot): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of allocateDates(plan.start, plan.route.map((r) => ({ cityId: r.city, nights: r.nights })), plan.end)) {
    for (const d of c.dates) out.set(d, c.cityId);
  }
  for (const d of plan.days) if (d.city) out.set(d.date, d.city);
  return out;
}

/** A stored snapshot, or null if it isn't one. */
export const snapshotFromRow = (v: unknown): PlanSnapshot | null => {
  const p = PlanSnapshotSchema.safeParse(v);
  return p.success ? p.data : null;
};

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
