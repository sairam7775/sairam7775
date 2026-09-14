import { DAY_BUDGET_MINUTES } from "@/lib/types";
import { hardFilter, parseClock, parseWindow } from "./filter";
import { buildReason, chooseDuration, DEFAULT_WEIGHTS, scorePlace, type ScoreContext } from "./score";
import type { Alternative, DayInput, DayPlan, Meal, PlaceInput, PlannedItem, Rejected, TravelLeg, Weights } from "./types";

/** When the graph cannot say, assume this and warn. Never silently zero. */
const FALLBACK_TRAVEL_MIN = 45;
const LUNCH_MIN = 60;
const LUNCH_EARLIEST = 11 * 60 + 30;
const LUNCH_LATEST = 14 * 60;
const MAX_VALIDATE_ROUNDS = 3;

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

interface Draft {
  place: PlaceInput;
  durationMin: number;
  locked: boolean;
  /** Step 3 chose it to open the day. Holds position 0 through ordering. */
  anchored: boolean;
  lockedStart: number | null;
  score: ReturnType<typeof scorePlace>;
  alternatives: Alternative[];
}

/** Scheduler, §05 Fig. 2. Greedy insertion with local search — not
 *  optimal, and it does not need to be. It needs to be right, fast, and
 *  explainable: every item carries the terms that put it there, and every
 *  place left out carries the rule or term that removed it. */
export function planDay(input: DayInput): DayPlan {
  const { date, cityId, places, traveller: t, travel } = input;
  const w: Weights = { ...DEFAULT_WEIGHTS, ...input.weights };
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = day.getUTCDay();
  const month = day.getUTCMonth() + 1;

  // 1 BUDGET
  const budgetMin = DAY_BUDGET_MINUTES[t.pace];
  const dayStart = input.dayStartMin ?? (t.crowdTolerance < 0.35 ? 7 * 60 : 9 * 60);
  const maxItems = input.maxItems ?? (t.pace === "packed" ? 7 : t.pace === "relaxed" ? 4 : 5);

  const considered: Rejected[] = [];
  const warnings: string[] = [];
  const byId = new Map(places.map((p) => [p.id, p]));

  // 2 FILTER
  const fctx = {
    date,
    weekday,
    bookedPlaceIds: new Set(input.bookedPlaceIds ?? []),
    usedPlaceIds: new Set(input.usedPlaceIds ?? []),
  };
  const lockedIds = new Set((input.locked ?? []).map((l) => l.placeId));
  const pool: PlaceInput[] = [];
  for (const p of places) {
    if (p.cityId !== cityId) continue;
    const r = hardFilter(p, t, fctx);
    if (r && !lockedIds.has(p.id)) {
      considered.push(r);
      continue;
    }
    if (r && lockedIds.has(p.id)) warnings.push(`${p.name} is pinned but ${r.detail} — kept because you pinned it`);
    pool.push(p);
  }

  // Travel, with an honest fallback.
  const tmemo = new Map<string, TravelLeg>();
  const legBetween = (a: PlaceInput, b: PlaceInput): TravelLeg => {
    const k = `${a.id}>${b.id}`;
    const hit = tmemo.get(k);
    if (hit) return hit;
    let leg = travel(a, b);
    if (!leg) {
      leg = { mode: "estimate", minutes: FALLBACK_TRAVEL_MIN, fareJpy: 0, fareKind: "estimate",
        detail: `About ${FALLBACK_TRAVEL_MIN} min — no transit data between ${a.name} and ${b.name} yet`, lines: [] };
      for (const p of [a, b]) {
        if (p.nearestStation) continue;
        const msg = `${p.name} has no station in the transit graph yet — legs to it are estimated at ${FALLBACK_TRAVEL_MIN} min`;
        if (!warnings.includes(msg)) warnings.push(msg);
      }
      if (a.nearestStation && b.nearestStation) {
        const msg = `No route between ${a.nearestStation} and ${b.nearestStation} in the graph yet — estimated at ${FALLBACK_TRAVEL_MIN} min`;
        if (!warnings.includes(msg)) warnings.push(msg);
      }
    }
    tmemo.set(k, leg);
    return leg;
  };
  const tmin = (a: PlaceInput | undefined, b: PlaceInput | undefined) => (a && b ? legBetween(a, b).minutes : 0);

  // ---- state
  let seq: Draft[] = [];
  const categoryCounts = () => {
    const m = new Map<string, number>();
    for (const d of seq) m.set(d.place.category, (m.get(d.place.category) ?? 0) + 1);
    return m;
  };
  const usedMin = () =>
    seq.reduce((s, d) => s + d.durationMin, 0) +
    seq.reduce((s, d, i) => s + (i ? tmin(seq[i - 1].place, d.place) : 0), 0);
  const remaining = () => budgetMin - usedMin();
  const earlyStart = dayStart <= 8 * 60;
  const ctx = (): ScoreContext => ({ categoryCounts: categoryCounts(), remainingMin: remaining(), month, earlyStart });

  const draftOf = (p: PlaceInput, locked = false, lockedStart: number | null = null): Draft => ({
    place: p,
    durationMin: chooseDuration(p, t.pace) ?? p.durationTypicalMin ?? 60,
    locked,
    anchored: false,
    lockedStart,
    score: scorePlace(p, t, ctx(), w),
    alternatives: [],
  });

  // Pinned items go in first and are never moved or dropped (§08).
  for (const l of input.locked ?? []) {
    const p = byId.get(l.placeId);
    if (!p) { warnings.push(`Pinned place ${l.placeId} is not in this city's list`); continue; }
    seq.push(draftOf(p, true, l.startMin ?? null));
  }
  seq.sort((a, b) => (a.lockedStart ?? Infinity) - (b.lockedStart ?? Infinity));

  const placed = () => new Set(seq.map((d) => d.place.id));
  const rejectedIds = () => new Set(considered.map((r) => r.placeId));

  const conflictWith = (p: PlaceInput): PlaceInput | undefined =>
    seq.map((d) => d.place).find((q) => p.conflictsWith.includes(q.id) || q.conflictsWith.includes(p.id));

  // 3 ANCHOR — the highest-scoring place with a morning window, for an early
  // riser; otherwise simply the highest-scoring place.
  if (seq.length === 0) {
    const scored = pool.map((p) => {
      const opens = parseClock(p.opensAt) ?? 0;
      const wait = Math.max(0, opens - dayStart);
      return { p, s: scorePlace(p, t, ctx(), w).total - w.travelPerHalfHour * (wait / 30) };
    });
    const early = t.crowdTolerance < 0.35 && dayStart <= 8 * 60;
    const withWindow = scored.filter(({ p }) => p.bestWindow.some((b) => parseWindow(b).before != null));
    const pick = (early && withWindow.length ? withWindow : scored).sort((a, b) => b.s - a.s)[0];
    if (pick) {
      const d = draftOf(pick.p);
      d.anchored = true;
      seq.push(d);
    }
  }

  // 4 GROW — insert the candidate with the best marginal (score minus the
  // travel it adds) until the budget is spent or nothing is worth adding.
  const grow = () => {
    for (;;) {
      if (seq.length >= maxItems) break;
      const done = placed();
      const skip = rejectedIds();
      const cands = pool.filter((p) => !done.has(p.id) && !skip.has(p.id));
      if (!cands.length) break;

      type Option = { p: PlaceInput; at: number; dTravel: number; score: ReturnType<typeof scorePlace>; marginal: number; duration: number };
      const options: Option[] = [];
      const rem = remaining();

      for (const p of cands) {
        const clash = conflictWith(p);
        if (clash) {
          considered.push({ placeId: p.id, name: p.name, stage: "conflict", term: "conflicts_with",
            detail: `can't share a day with ${clash.name} — they're at opposite ends of the city` });
          continue;
        }
        const duration = chooseDuration(p, t.pace)!;
        const sc = scorePlace(p, t, ctx(), w);
        let best: Option | null = null;
        // The anchor opened the day for a reason; nothing goes in front of it.
        for (let at = seq[0]?.anchored ? 1 : 0; at <= seq.length; at++) {
          const prev = seq[at - 1]?.place;
          const next = seq[at]?.place;
          const dTravel = tmin(prev, p) + tmin(p, next) - tmin(prev, next);
          const marginal = sc.total - w.travelPerHalfHour * (dTravel / 30);
          if (!best || marginal > best.marginal) best = { p, at, dTravel, score: sc, marginal, duration };
        }
        if (best) options.push(best);
      }

      const fits = options.filter((o) => o.duration + o.dTravel <= rem);
      const ranked = fits.filter((o) => o.marginal > 0).sort((a, b) => b.marginal - a.marginal);
      const winner = ranked[0];

      if (!winner) {
        // Nothing worth adding. Say why, per candidate, once.
        for (const o of options) {
          if (rejectedIds().has(o.p.id)) continue;
          if (o.duration + o.dTravel > rem) {
            considered.push({ placeId: o.p.id, name: o.p.name, stage: "grow", term: "no_time",
              detail: `needs ${o.duration} min plus ${o.dTravel} min travel; ${Math.max(0, rem)} min left in the day` });
          } else {
            const worst = [...o.score.terms].sort((a, b) => a.contribution - b.contribution)[0];
            const far = o.dTravel >= 30 ? `far from the rest of the day (+${o.dTravel} min)` : null;
            considered.push({ placeId: o.p.id, name: o.p.name, stage: "grow", term: far ? "travel" : worst.term,
              detail: far ?? worst.clause ?? `scored ${o.score.total.toFixed(1)} — not enough to earn a slot` });
          }
        }
        break;
      }

      const d = draftOf(winner.p);
      d.score = winner.score;
      d.alternatives = ranked.slice(1, 4).map((o) => ({
        placeId: o.p.id, name: o.p.name, score: o.marginal,
        whyNot: o.dTravel > winner.dTravel + 15
          ? `further from the rest of the day (+${o.dTravel - winner.dTravel} min)`
          : `scored a little lower: ${[...o.score.terms].sort((a, b) => a.contribution - b.contribution)[0].term.replace(/_/g, " ")}`,
      }));
      seq.splice(winner.at, 0, d);
    }
  };

  // 5 ORDER — 2-opt over unpinned runs. The objective is travel plus a
  // charge for every busy place that would miss its quiet window, so a
  // "before 08:00" shrine is not shuffled to midday just to save a hop.
  const WINDOW_MISS_MIN = 30;
  const order = () => {
    const total = () => {
      let travelMin = 0;
      let clockAt = dayStart;
      let miss = 0;
      seq.forEach((d, i) => {
        const hop = i ? tmin(seq[i - 1].place, d.place) : 0;
        travelMin += hop;
        clockAt += hop;
        const opens = parseClock(d.place.opensAt) ?? 0;
        if (clockAt < opens) clockAt = opens;
        if ((d.place.crowdLevel ?? 0) >= 0.7 && d.place.bestWindow.length) {
          const ok = d.place.bestWindow.some((win) => {
            const { before, after } = parseWindow(win);
            return (before != null && clockAt <= before) || (after != null && clockAt >= after);
          });
          if (!ok) miss++;
        }
        clockAt += d.durationMin;
      });
      return travelMin + miss * WINDOW_MISS_MIN;
    };
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 50) {
      improved = false;
      for (let i = 0; i < seq.length - 1; i++) {
        for (let j = i + 1; j < seq.length; j++) {
          if (seq.slice(i, j + 1).some((d) => d.locked || d.anchored)) continue;
          const before = total();
          const rev = [...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)];
          const saved = seq;
          seq = rev;
          if (total() < before) improved = true;
          else seq = saved;
        }
      }
    }
    // Pins with a fixed time go where the clock reaches them; everything
    // else keeps the order the geometry chose. Arriving early and waiting
    // is fine; arriving late is what this prevents.
    const pins = seq.filter((d) => d.lockedStart != null).sort((a, b) => a.lockedStart! - b.lockedStart!);
    if (pins.length) {
      let rest = seq.filter((d) => d.lockedStart == null);
      for (const pin of pins) {
        let clockAt = dayStart;
        let at = rest.length;
        for (let i = 0; i < rest.length; i++) {
          const finishI = clockAt + tmin(rest[i - 1]?.place, rest[i].place) + rest[i].durationMin;
          if (finishI + tmin(rest[i].place, pin.place) > pin.lockedStart!) { at = i; break; }
          clockAt = finishI;
        }
        rest = [...rest.slice(0, at), pin, ...rest.slice(at)];
      }
      seq = rest;
    }
  };

  // 6 TIME — clock times from opening hours, transit and a lunch slot.
  const time = (): { items: PlannedItem[]; meals: Meal[]; violations: Rejected[]; endMin: number; fares: number; fareKind: "exact" | "estimate" } => {
    const items: PlannedItem[] = [];
    const meals: Meal[] = [];
    const violations: Rejected[] = [];
    let tNow = dayStart;
    let fares = 0;
    let fareKind: "exact" | "estimate" = "exact";
    let lunchDone = false;

    seq.forEach((d, i) => {
      const p = d.place;
      let arriveBy: TravelLeg | null = null;
      if (i > 0) {
        arriveBy = legBetween(seq[i - 1].place, p);
        tNow += arriveBy.minutes;
        fares += arriveBy.fareJpy;
        if (arriveBy.fareKind === "estimate") fareKind = "estimate";
      }
      if (!lunchDone && tNow >= LUNCH_EARLIEST && tNow <= LUNCH_LATEST) {
        meals.push({ kind: "lunch", startMin: tNow, endMin: tNow + LUNCH_MIN });
        tNow += LUNCH_MIN;
        lunchDone = true;
      }
      const opens = parseClock(p.opensAt) ?? 0;
      const closes = parseClock(p.closesAt) ?? 24 * 60;
      const extra: string[] = [];
      if (tNow < opens) {
        const wait = opens - tNow;
        extra.push(wait > 20 ? `opens at ${clock(opens)}` : `opens at ${clock(opens)}, so a short wait`);
        if (wait > 20) warnings.push(`${p.name} opens at ${clock(opens)} — the day waits ${wait} min for it`);
        tNow = opens;
      }

      // The score that explains this item is the one against the day as
      // finally ordered: "your third temple" must be the third one shown.
      const before = new Map<string, number>();
      let usedBefore = 0;
      for (let k = 0; k < i; k++) {
        before.set(seq[k].place.category, (before.get(seq[k].place.category) ?? 0) + 1);
        usedBefore += seq[k].durationMin + (k ? tmin(seq[k - 1].place, seq[k].place) : 0);
      }
      d.score = scorePlace(p, t, { categoryCounts: before, remainingMin: budgetMin - usedBefore, month, earlyStart }, w);
      if (d.lockedStart != null) {
        if (tNow > d.lockedStart) warnings.push(`${p.name} is pinned for ${clock(d.lockedStart)} but the day only reaches it by ${clock(tNow)}`);
        else tNow = d.lockedStart;
      }
      const startMin = tNow;
      const endMin = startMin + d.durationMin;

      if (endMin > closes) {
        violations.push({ placeId: p.id, name: p.name, stage: "validate", term: "hours",
          detail: `closes at ${clock(closes)}; you'd arrive at ${clock(startMin)} and need ${d.durationMin} min` });
      }

      // Window clauses: the honest version of "go early".
      for (const win of p.bestWindow) {
        const { before, after } = parseWindow(win);
        if (before != null && startMin <= before) extra.push(`starting ${clock(startMin)}, before it fills`);
        else if (before != null && (p.crowdLevel ?? 0) >= 0.8) extra.push(`the busiest hour of your day, and unavoidable — it's worth the crowd`);
        if (after != null && startMin >= after) extra.push(`after ${clock(after)}, when it empties out`);
      }

      const { reason, terms } = buildReason(d.score, extra);
      items.push({
        placeId: p.id, name: p.name, category: p.category,
        startMin, endMin, durationMin: d.durationMin, locked: d.locked,
        score: d.score, reason, reasonTerms: terms,
        arriveBy, alternatives: d.alternatives,
        costJpy: p.costJpy ?? 0,
      });
      tNow = endMin;
    });

    // Lunch after a late-running morning, if it never fitted between stops.
    if (!lunchDone && tNow >= LUNCH_EARLIEST && items.length) {
      meals.push({ kind: "lunch", startMin: tNow, endMin: tNow + LUNCH_MIN });
      tNow += LUNCH_MIN;
    }
    return { items, meals, violations, endMin: tNow, fares, fareKind };
  };

  // 7 VALIDATE — drop what the hours reject, refill, re-time. Bounded.
  let timed: ReturnType<typeof time> = { items: [], meals: [], violations: [], endMin: dayStart, fares: 0, fareKind: "exact" };
  for (let round = 0; round < MAX_VALIDATE_ROUNDS; round++) {
    grow();
    order();
    timed = time();
    const drop = timed.violations.filter((v) => !seq.find((d) => d.place.id === v.placeId)?.locked);
    if (!drop.length) break;
    considered.push(...drop);
    seq = seq.filter((d) => !drop.some((v) => v.placeId === d.place.id));
    if (round === MAX_VALIDATE_ROUNDS - 1) warnings.push("Some places could not be fitted to their opening hours");
  }

  const activeMin = usedMin();
  const placesJpy = timed.items.reduce((s, i) => s + i.costJpy, 0);

  return {
    date, cityId,
    items: timed.items,
    meals: timed.meals,
    startMin: timed.items[0]?.startMin ?? dayStart,
    endMin: timed.endMin,
    budgetMin,
    activeMin,
    slackMin: Math.max(0, budgetMin - activeMin),
    placesJpy,
    faresJpy: timed.fares,
    costJpy: placesJpy + timed.fares,
    fareKind: timed.fareKind,
    considered: dedupe(considered),
    warnings,
  };
}

function dedupe(rs: Rejected[]): Rejected[] {
  const seen = new Set<string>();
  return rs.filter((r) => (seen.has(r.placeId) ? false : (seen.add(r.placeId), true)));
}
