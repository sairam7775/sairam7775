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

export const ProposalSchema = z.object({
  summary: z.string(),
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
  if (!existing.length) parts.push(`${after.length} stop${after.length === 1 ? "" : "s"}`);
  else {
    if (added) parts.push(`${added} added`);
    if (removed.length) parts.push(`${removed.length} removed`);
    if (moved) parts.push(`${moved} moved`);
    if (!parts.length) parts.push("no change");
  }
  const h = Math.floor(plan.activeMin / 60);
  const m = plan.activeMin % 60;
  const summary = `${parts.join(", ")} · ${h}h${m ? ` ${m}m` : ""} active · ${plan.fareKind === "exact" ? "" : "~"}¥${plan.costJpy.toLocaleString("en")}`;

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
  const names = after.map((c) => (c.nights ? `${c.name} ${c.nights}n` : `${c.name} (day)`)).join(" → ");
  return {
    kind: "route",
    before,
    after,
    summary: `${names} · ${a.verdict}`,
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
  const dayList = [...days.values()].sort((x, y) => x.date.localeCompare(y.date));
  const summaryParts = [route ? route.summary : null, dayList.length ? `${dayList.length} day${dayList.length === 1 ? "" : "s"}` : null].filter(Boolean);
  return { summary: summaryParts.join(" · "), route, days: dayList };
}

export const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
