/** §08 — diffs, not regeneration.
 *
 *  The itinerary is structured state in the database. The model never
 *  writes it. The engine produces a proposal — the day as it would be,
 *  next to the day as it is — and the traveller accepts or rejects it.
 *
 *  Every proposal is validated against these schemas before it is stored
 *  and again before it is applied (spec §15, model drift). */
import { z } from "zod";
import type { DayPlan } from "@/lib/engine/types";
import type { RouteAssessment } from "@/lib/engine/route";
import { copy } from "@/copy";

export const DiffItemSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  startMin: z.number().int(),
  endMin: z.number().int(),
  durationMin: z.number().int(),
  locked: z.boolean(),
  reason: z.string(),
  reasonTerms: z.array(z.string()),
  arriveMode: z.string().nullable(),
  arriveMinutes: z.number().int().nullable(),
  arriveDetail: z.string().nullable(),
  costJpy: z.number().int(),
  change: z.enum(["kept", "added", "moved", "removed"]),
});
export type DiffItem = z.infer<typeof DiffItemSchema>;

export const DayDiffSchema = z.object({
  kind: z.literal("day"),
  date: z.string(),
  cityId: z.string(),
  /** The day as it would be, in order, each item flagged against today. */
  after: z.array(DiffItemSchema),
  /** What the proposal drops. */
  removed: z.array(z.object({ placeId: z.string(), name: z.string() })),
  summary: z.string(),
  warnings: z.array(z.string()),
  activeMin: z.number().int(),
  slackMin: z.number().int(),
  budgetMin: z.number().int(),
  costJpy: z.number().int(),
  fareKind: z.enum(["exact", "estimate"]),
  /** Left out, with the term that removed it. The most convincing part. */
  considered: z.array(z.object({ name: z.string(), term: z.string(), detail: z.string() })),
});
export type DayDiff = z.infer<typeof DayDiffSchema>;

export const RouteCitySchema = z.object({
  cityId: z.string(),
  name: z.string(),
  nights: z.number().int().min(0),
  reason: z.string().nullable(),
  budgetBand: z.enum(["budget", "mid", "comfortable"]).nullable(),
  arriveDate: z.string().nullable(),
  departDate: z.string().nullable(),
  tier: z.enum(["deep", "outline", "stub"]),
});
export type RouteCity = z.infer<typeof RouteCitySchema>;

export const RouteDiffSchema = z.object({
  kind: z.literal("route"),
  before: z.array(RouteCitySchema),
  after: z.array(RouteCitySchema),
  summary: z.string(),
  verdict: z.enum(["fine", "tight", "overpacked"]),
  arithmetic: z.string(),
});
export type RouteDiff = z.infer<typeof RouteDiffSchema>;

export const TripFieldsSchema = z.object({
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  partySize: z.number().int().min(1).max(20),
  title: z.string().nullable(),
});
export type TripFields = z.infer<typeof TripFieldsSchema>;

/** A change of trip dates (#6): proposed, not applied, unless the traveller
 *  has said Bento Man may change dates without asking. `before` is the trip
 *  the proposal was made against; accepting refuses if it has moved since. */
export const DatesDiffSchema = z.object({
  kind: z.literal("dates"),
  before: TripFieldsSchema,
  after: TripFieldsSchema,
  summary: z.string(),
});
export type DatesDiff = z.infer<typeof DatesDiffSchema>;

export const ProposalSchema = z.object({
  summary: z.string(),
  dates: DatesDiffSchema.optional(),
  route: RouteDiffSchema.optional(),
  days: z.array(DayDiffSchema),
});
export type Proposal = z.infer<typeof ProposalSchema>;

/** Parse untrusted JSON (a database column, a request body) into a
 *  Proposal, or null. Never throws — a corrupt proposal is shown as absent
 *  rather than crashing the page. */
export function parseProposal(raw: unknown): Proposal | null {
  const r = ProposalSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** An itinerary item as it exists today. Enough to diff against. */
export interface ExistingItem {
  placeId: string;
  name: string;
  sortOrder: number;
  startMin: number | null;
  locked: boolean;
}

export function computeDayDiff(existing: ExistingItem[], plan: DayPlan): DayDiff {
  const afterIds = new Set(plan.items.map((it) => it.placeId));
  // "Moved" means its place in the sequence changed relative to the other
  // stops that survived — not that the clock shifted because something
  // before it was dropped. The times are shown anyway.
  const survivorsBefore = [...existing].sort((a, b) => a.sortOrder - b.sortOrder).filter((e) => afterIds.has(e.placeId)).map((e) => e.placeId);
  const survivorsAfter = plan.items.filter((it) => survivorsBefore.includes(it.placeId)).map((it) => it.placeId);
  const rankBefore = new Map(survivorsBefore.map((id, i) => [id, i]));
  const rankAfter = new Map(survivorsAfter.map((id, i) => [id, i]));

  const after: DiffItem[] = plan.items.map((it) => {
    let change: DiffItem["change"] = "kept";
    if (!rankBefore.has(it.placeId)) change = "added";
    else if (rankBefore.get(it.placeId) !== rankAfter.get(it.placeId)) change = "moved";
    return {
      placeId: it.placeId,
      name: it.name,
      startMin: it.startMin,
      endMin: it.endMin,
      durationMin: it.durationMin,
      locked: it.locked,
      reason: it.reason,
      reasonTerms: it.reasonTerms,
      arriveMode: it.arriveBy?.mode ?? null,
      arriveMinutes: it.arriveBy?.minutes ?? null,
      arriveDetail: it.arriveBy?.detail ?? null,
      costJpy: it.costJpy,
      change,
    };
  });

  const removed = existing.filter((e) => !afterIds.has(e.placeId)).map((e) => ({ placeId: e.placeId, name: e.name }));

  const added = after.filter((a) => a.change === "added").length;
  const moved = after.filter((a) => a.change === "moved").length;
  const parts: string[] = [];
  if (!existing.length) parts.push(copy.plan.day.stops(after.length));
  else {
    if (added) parts.push(copy.plan.day.added(added));
    if (removed.length) parts.push(copy.plan.day.removed(removed.length));
    if (moved) parts.push(copy.plan.day.moved(moved));
    if (!parts.length) parts.push(copy.plan.day.noChange);
  }
  const summary = copy.plan.day.summary(parts.join(", "), copy.time.duration(plan.activeMin), plan.costJpy.toLocaleString(copy.locale), plan.fareKind !== "exact");

  return {
    kind: "day",
    date: plan.date,
    cityId: plan.cityId,
    after,
    removed,
    summary,
    warnings: plan.warnings,
    activeMin: plan.activeMin,
    slackMin: plan.slackMin,
    budgetMin: plan.budgetMin,
    costJpy: plan.costJpy,
    fareKind: plan.fareKind,
    considered: plan.considered.slice(0, 8).map((c) => ({ name: c.name, term: c.term, detail: c.detail })),
  };
}

export function routeDiffFrom(before: RouteCity[], after: RouteCity[], a: RouteAssessment): RouteDiff {
  const names = after.map((c) => (c.nights ? copy.plan.route.summaryCity(c.name, c.nights) : copy.plan.route.summaryDayTrip(c.name))).join(copy.trip.routeJoin);
  return {
    kind: "route",
    before,
    after,
    summary: copy.plan.route.summary(names, copy.plan.route.verdict[a.verdict]),
    verdict: a.verdict,
    arithmetic: a.arithmetic,
  };
}

/** A proposal that is only route or only days, or both, with one summary. */
export function mergeProposals(a: Proposal | null, b: Proposal): Proposal {
  if (!a) return b;
  const days = new Map(a.days.map((d) => [d.date, d]));
  for (const d of b.days) days.set(d.date, d);
  const route = b.route ?? a.route;
  // A later date change in the same turn replaces the earlier one, but
  // keeps the trip it was first measured against.
  const dates = b.dates ? (a.dates ? { ...b.dates, before: a.dates.before } : b.dates) : a.dates;
  const dayList = [...days.values()].sort((x, y) => x.date.localeCompare(y.date));
  const summaryParts = [dates ? dates.summary : null, route ? route.summary : null, dayList.length ? copy.plan.day.days(dayList.length) : null].filter(Boolean);
  return { summary: summaryParts.join(copy.plan.day.join), ...(dates ? { dates } : {}), route, days: dayList };
}

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { day: "numeric", month: "short", timeZone: "UTC" });

/** "1 Oct – 10 Oct (9 nights)", or "no dates". */
export function describeDates(t: Pick<TripFields, "startDate" | "endDate">): string {
  if (!t.startDate && !t.endDate) return copy.plan.dates.none;
  const nights = t.startDate && t.endDate ? Math.round((Date.parse(`${t.endDate}T00:00:00Z`) - Date.parse(`${t.startDate}T00:00:00Z`)) / 86_400_000) : null;
  const range = copy.plan.dates.range(t.startDate ? shortDate(t.startDate) : copy.plan.dates.unknown, t.endDate ? shortDate(t.endDate) : copy.plan.dates.unknown);
  return nights == null ? range : copy.plan.dates.rangeNights(range, nights);
}

export function datesDiff(before: TripFields, after: TripFields): DatesDiff {
  return { kind: "dates", before, after, summary: copy.plan.dates.summary(describeDates(after)) };
}

export const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
