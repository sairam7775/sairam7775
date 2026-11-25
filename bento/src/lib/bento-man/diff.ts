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
import { clock, describeDates } from "./diff-text";
import { isCustomStop } from "./custom-stop";

export const DiffItemSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  // Older proposals have no Japanese name, so keep this optional on read.
  nameJa: z.string().nullable().optional(),
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

const DayBaseItemSchema = z.object({
  placeId: z.string().nullable(), sortOrder: z.number().int(), locked: z.boolean(),
  startMin: z.number().int().nullable(), durationMin: z.number().int().nullable(),
  arriveMode: z.string().nullable(), arriveMinutes: z.number().int().nullable(), arriveDetail: z.string().nullable(),
  /** A free-text stop's name (0036); absent on every other stop, and on
   *  every base stored before 0036. */
  customName: z.string().optional(),
});

export const DayDiffSchema = z.object({
  kind: z.literal("day"),
  date: z.string(),
  cityId: z.string(),
  /** Absent on legacy proposals; [] means the day was empty. */
  base: z.array(DayBaseItemSchema).optional(),
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

/** A train journey between two stops, as the engine described it. */
export const RouteLegSchema = z.object({
  fromCityId: z.string(),
  toCityId: z.string(),
  movingTo: z.string().nullable(),
  summary: z.string(),
  lines: z.array(z.string()),
});

export const RouteDiffSchema = z.object({
  kind: z.literal("route"),
  before: z.array(RouteCitySchema),
  after: z.array(RouteCitySchema),
  summary: z.string(),
  verdict: z.enum(["fine", "tight", "overpacked"]),
  arithmetic: z.string(),
  // Proposals saved before the trains were shown have none.
  legs: z.array(RouteLegSchema).optional(),
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

/** The proposal as the browser gets it: without each day's `base`, which
 *  only the accept check on the server reads (from the stored row). */
export function proposalForClient(p: Proposal): Proposal {
  return {
    ...p,
    days: p.days.map((d) => {
      const day = { ...d };
      delete day.base;
      return day;
    }),
  };
}

/** An itinerary item as it exists today. Enough to diff against. */
export interface ExistingItem {
  placeId: string;
  name: string;
  sortOrder: number;
  startMin: number | null;
  locked: boolean;
  durationMin?: number | null;
  arriveMode?: string | null;
  arriveMinutes?: number | null;
  arriveDetail?: string | null;
  /** A free-text stop's name (0036). */
  customName?: string | null;
}

export type DayBaseItem = z.infer<typeof DayBaseItemSchema>;

// Nulls last, as Postgres sorts ascending. Strings by code point, which is
// the byte order of UTF-8 and so of `collate "C"`; numbers as numbers;
// false before true.
function cmp(a: string | number | boolean | null, b: string | number | boolean | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === "string" && typeof b === "string") {
    const x = [...a], y = [...b];
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const d = x[i].codePointAt(0)! - y[i].codePointAt(0)!;
      if (d) return d;
    }
    return x.length - y.length;
  }
  return Number(a) - Number(b);
}

/** One total order over every compared field, so two stops that share a
 *  sort order still come out the same way here and in 0036's day_base
 *  `order by i.sort_order, i.place_id collate "C" nulls last,
 *  i.custom_name collate "C" nulls last, <start
 *  minute> nulls last, i.duration_min nulls last, i.locked, i.arrive_mode
 *  collate "C" nulls last, i.arrive_minutes nulls last, i.arrive_detail
 *  collate "C" nulls last`. Change both together. Stops equal on every
 *  field are identical in the base, so their order can't matter. */
function byBaseOrder(a: DayBaseItem, b: DayBaseItem): number {
  return a.sortOrder - b.sortOrder
    || cmp(a.placeId, b.placeId)
    || cmp(a.customName ?? null, b.customName ?? null)
    || cmp(a.startMin, b.startMin)
    || cmp(a.durationMin, b.durationMin)
    || cmp(a.locked, b.locked)
    || cmp(a.arriveMode, b.arriveMode)
    || cmp(a.arriveMinutes, b.arriveMinutes)
    || cmp(a.arriveDetail, b.arriveDetail);
}

/** Only fields hand edits write: no generated row ids or display names. */
export function dayBase(items: ExistingItem[]): DayBaseItem[] {
  return items.map((i) => {
    const base: DayBaseItem = {
      // A free-text stop (0036) has no place_id, as day_base reads it.
      placeId: isCustomStop(i.placeId) ? null : i.placeId, sortOrder: i.sortOrder, locked: i.locked, startMin: i.startMin,
      durationMin: i.durationMin ?? null, arriveMode: i.arriveMode ?? null,
      arriveMinutes: i.arriveMinutes ?? null, arriveDetail: i.arriveDetail ?? null,
    };
    // Only a free-text stop has the key, as only it has a name in day_base.
    if (isCustomStop(i.placeId) && i.customName) base.customName = i.customName;
    return base;
  }).sort(byBaseOrder);
}

/** The accept check: the stored base, as stored (the database doesn't
 *  re-sort it either), against the day as saved now. */
export function baseMatches(base: DayBaseItem[], saved: ExistingItem[]): boolean {
  const now = dayBase(saved);
  const keys: (keyof DayBaseItem)[] = ["placeId", "customName", "sortOrder", "locked", "startMin", "durationMin", "arriveMode", "arriveMinutes", "arriveDetail"];
  return base.length === now.length && base.every((b, i) => keys.every((k) => (b[k] ?? null) === (now[i][k] ?? null)));
}

/** `existing` is the day the plan is compared with (change flags, removed
 *  stops). `saved` is the day as stored for that date, recorded as `base`
 *  for the stale check at accept. They differ only when the caller plans
 *  against a working state, such as a route proposed earlier in the turn
 *  that drops the day's saved city. */
export function computeDayDiff(existing: ExistingItem[], plan: DayPlan, places: { id: string; nameJa?: string | null }[] = [], saved: ExistingItem[] = existing): DayDiff {
  const afterIds = new Set(plan.items.map((it) => it.placeId));
  // "Moved" means its place in the sequence changed relative to the other
  // stops that survived — not that the clock shifted because something
  // before it was dropped. The times are shown anyway.
  const survivorsBefore = [...existing].sort((a, b) => a.sortOrder - b.sortOrder).filter((e) => afterIds.has(e.placeId)).map((e) => e.placeId);
  const survivorsAfter = plan.items.filter((it) => survivorsBefore.includes(it.placeId)).map((it) => it.placeId);
  const rankBefore = new Map(survivorsBefore.map((id, i) => [id, i]));
  const rankAfter = new Map(survivorsAfter.map((id, i) => [id, i]));
  const nameJaById = new Map(places.map((place) => [place.id, place.nameJa ?? null]));

  const after: DiffItem[] = plan.items.map((it) => {
    let change: DiffItem["change"] = "kept";
    if (!rankBefore.has(it.placeId)) change = "added";
    else if (rankBefore.get(it.placeId) !== rankAfter.get(it.placeId)) change = "moved";
    return {
      placeId: it.placeId,
      name: it.name,
      ...(nameJaById.has(it.placeId) ? { nameJa: nameJaById.get(it.placeId)! } : {}),
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
  // Place prices are bands, not promises, so a day with a paid stop is an estimate.
  const estimate = plan.fareKind !== "exact" || after.some((a) => a.costJpy > 0);
  const summary = copy.plan.day.summary(parts.join(", "), copy.time.duration(plan.activeMin), plan.costJpy.toLocaleString(copy.locale), estimate);

  return {
    kind: "day",
    date: plan.date,
    cityId: plan.cityId,
    base: dayBase(saved),
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
  // The cities only: the verdict is shown in words under the route (the
  // arithmetic, coloured by how tight it is), never as the engine's label.
  const summary = after.map((c) => (c.nights ? copy.plan.route.summaryCity(c.name, c.nights) : copy.plan.route.summaryDayTrip(c.name))).join(copy.trip.routeJoin);
  return {
    kind: "route",
    before,
    after,
    summary,
    verdict: a.verdict,
    arithmetic: a.arithmetic,
    legs: a.legs.map((l) => ({ fromCityId: l.fromCityId, toCityId: l.toCityId, movingTo: l.movingTo, summary: l.summary, lines: l.lines })),
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

export function datesDiff(before: TripFields, after: TripFields): DatesDiff {
  return { kind: "dates", before, after, summary: copy.plan.dates.summary(describeDates(after)) };
}

export { clock, describeDates };
