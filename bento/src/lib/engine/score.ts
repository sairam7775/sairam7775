import { INTEREST_TAGS } from "@/lib/types";
import type { PlaceInput, ScoreBreakdown, ScoreTerm, TravellerInput, Weights } from "./types";

export const DEFAULT_WEIGHTS: Weights = {
  interestMatch: 2.5,
  signature: 1.5,
  confidence: 1.0,
  seasonFit: 0.8,
  discoveryFit: 0.5,
  redundancy: 2.0,
  crowd: 1.2,
  energy: 1.0,
  skipIf: 1.5,
  budgetStrain: 1.0,
  paceStrain: 0.7,
  travelPerHalfHour: 1.0,
};

/** Month (1–12) → what is in season. */
const SEASON_BY_MONTH: Record<number, { key: string; label: string } | undefined> = {
  3: { key: "sakura", label: "cherry blossom" },
  4: { key: "sakura", label: "cherry blossom" },
  11: { key: "koyo", label: "autumn colour" },
  12: { key: "koyo", label: "autumn colour" },
};

/** Spend that starts to sting, by band. Seed values. */
const BUDGET_THRESHOLD_JPY: Record<string, number> = { budget: 1000, mid: 3000, comfortable: 8000 };

/** Mobility flags that are needs, not preferences. A skip_if match on one
 *  of these is a hard exclusion, handled in filter.ts, never a penalty. */
export const HARD_MOBILITY = new Set(["limited_mobility", "wheelchair", "step_free"]);

export interface ScoreContext {
  /** Category → how many already in the day. */
  categoryCounts: Map<string, number>;
  remainingMin: number;
  month: number;
  /** The day starts by 08:00, so a "before 08:00" window is reachable. */
  earlyStart?: boolean;
}

/** How long the traveller actually spends, by pace. Null when the record
 *  has no verified duration — which is what makes a draft unschedulable. */
export function chooseDuration(p: PlaceInput, pace: TravellerInput["pace"]): number | null {
  if (pace === "packed") return p.durationTasteMin ?? p.durationTypicalMin;
  if (pace === "relaxed") return p.durationFullMin ?? p.durationTypicalMin;
  return p.durationTypicalMin;
}

const label = (tag: string) => INTEREST_TAGS.find((t) => t.id === tag)?.label.toLowerCase() ?? tag;
const ordinal = (n: number) => ["", "first", "second", "third", "fourth", "fifth", "sixth"][n] ?? `${n}th`;

/** Fig. 1. Every term contributes a clause to the shown reason, so the
 *  reason is true by construction rather than written after the fact. */
export function scorePlace(
  p: PlaceInput,
  t: TravellerInput,
  ctx: ScoreContext,
  w: Weights = DEFAULT_WEIGHTS,
): ScoreBreakdown {
  const terms: ScoreTerm[] = [];
  const add = (term: string, value: number, weight: number, sign: 1 | -1, clause?: string) => {
    const v = Math.max(0, Math.min(1, value));
    terms.push({ term, value: v, weight, contribution: sign * weight * v, clause: v > 0 ? clause : undefined });
  };

  // ---- positives
  const matched = p.interestTags.filter((tag) => t.interestTags.includes(tag));
  const dice = p.interestTags.length + t.interestTags.length
    ? (2 * matched.length) / (p.interestTags.length + t.interestTags.length)
    : 0;
  add("interest_match", dice, w.interestMatch, 1,
    matched.length ? `matches ${matched.map(label).join(" and ")}` : undefined);

  add("signature", p.signature, w.signature, 1,
    p.signature >= 0.8 ? "the one first-timers regret missing" : undefined);

  add("confidence", p.verificationStatus === "verified" ? 1 : 0.4, w.confidence, 1);

  const season = SEASON_BY_MONTH[ctx.month];
  const seasonValue = !p.seasons?.length ? 0.5 : season && p.seasons.includes(season.key) ? 1 : 0.3;
  add("season_fit", seasonValue, w.seasonFit, 1,
    seasonValue === 1 && season ? `at its best now — ${season.label}` : undefined);

  const discovery = p.discovery ?? 0.5;
  add("discovery_fit", 1 - Math.abs(discovery - t.discovery), w.discoveryFit, 1,
    discovery >= 0.7 && t.discovery >= 0.6 ? "most visitors miss it" : undefined);

  // ---- penalties
  const n = ctx.categoryCounts.get(p.category) ?? 0;
  add("redundancy", n > 0 ? 1 - 1 / (n + 1) : 0, w.redundancy, -1,
    n >= 2 ? `your ${ordinal(n + 1)} ${p.category} today` : undefined);

  const hasMorningWindow = p.bestWindow.some((b) => /^before/i.test(b));
  const beatable = hasMorningWindow && ctx.earlyStart;
  const crowd = (p.crowdLevel ?? 0.5) * (1 - t.crowdTolerance) * (beatable ? 0.35 : 1);
  add("crowd", crowd, w.crowd, -1,
    beatable && (p.crowdLevel ?? 0) >= 0.7 ? "quiet if you're there early"
      : crowd > 0.5 ? (hasMorningWindow ? "busy — go early" : "busy at any hour")
      : undefined);

  add("energy", Math.max(0, (p.energy ?? 0.5) - t.energy), w.energy, -1,
    (p.energy ?? 0.5) - t.energy > 0.4 ? "more effort than you said you wanted" : undefined);

  const softFlags = new Set<string>([
    ...(t.pace === "packed" ? ["packed_schedule"] : []),
    ...t.mobility.filter((m) => !HARD_MOBILITY.has(m)),
  ]);
  const skipHit = p.skipIf.find((s) => softFlags.has(s));
  add("skip_if", skipHit ? 1 : 0, w.skipIf, -1, skipHit ? `you might skip it: ${skipHit.replace(/_/g, " ")}` : undefined);

  const threshold = BUDGET_THRESHOLD_JPY[t.budgetBand ?? "mid"];
  const cost = p.costJpy ?? 0;
  const strain = cost > threshold ? Math.min(1, (cost - threshold) / threshold) : 0;
  add("budget_strain", strain, w.budgetStrain, -1,
    strain > 0 ? `pricey for your budget here (¥${cost.toLocaleString("en")})` : undefined);

  const d = chooseDuration(p, t.pace) ?? 0;
  const pace = d > ctx.remainingMin ? 1 : 0.5 * (d / Math.max(1, ctx.remainingMin));
  add("pace_strain", pace, w.paceStrain, -1);

  return { total: terms.reduce((s, x) => s + x.contribution, 0), terms };
}

/** The clauses that moved the score most, as one sentence a traveller can
 *  argue with. The scheduler appends timing clauses of its own. */
export function buildReason(b: ScoreBreakdown, extra: string[] = []): { reason: string; terms: string[] } {
  const ranked = [...b.terms].filter((x) => x.clause).sort((x, y) => Math.abs(y.contribution) - Math.abs(x.contribution));
  const positives = ranked.filter((x) => x.contribution > 0).slice(0, 2);
  const negative = ranked.find((x) => x.contribution < 0 && Math.abs(x.contribution) >= 0.5);
  const clauses = [...positives, ...(negative ? [negative] : [])];
  const text = [...clauses.map((c) => c.clause!), ...extra].filter(Boolean);
  const sentence = text.length ? text.join("; ").replace(/^./, (c) => c.toUpperCase()) + "." : "";
  return { reason: sentence, terms: clauses.map((c) => c.term) };
}
