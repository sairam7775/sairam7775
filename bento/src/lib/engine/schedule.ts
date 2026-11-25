import { DAY_BUDGET_MINUTES } from "@/lib/types";
import { hardFilter, parseClock, parseWindow } from "./filter";
import { buildReason, chooseDuration, DEFAULT_WEIGHTS, scorePlace, type ScoreContext } from "./score";
import type { Alternative, DayInput, DayPlan, Meal, PlaceInput, PlannedItem, Rejected, TravelLeg, TravellerInput, Weights } from "./types";
import { copy } from "@/copy";
import { toFive } from "./travel-day";
import { metresBetween } from "./travel";
import { daylightEndMin } from "./daylight";

/** When the graph cannot say, assume this and warn. Never silently zero. */
const FALLBACK_TRAVEL_MIN = 45;
const LUNCH_MIN = 60;
const LUNCH_EARLIEST = 11 * 60 + 30;
const LUNCH_LATEST = 14 * 60;
const MAX_VALIDATE_ROUNDS = 3;
/** A guard, not the pace: the budget decides how full a day is. Packed
 *  visits are short, so a packed day can hold this many. */
const MAX_STOPS = 12;
/** A long stay's share of the places never holds a day below this. */
const SHARE_FLOOR = 4;
/** A chosen stop may keep the day waiting this long for it to open: the
 *  point at which the day warns "the day waits … for it". */
export const OPEN_WAIT_MAX_MIN = 20;
/** …unless nothing fits without a wait: then up to two hours, an early
 *  riser's 07:00 start before anything near opens at 09:00. Evening-only
 *  places have their own rule (`eveningFrom`, below). */
const OPEN_WAIT_LAST_RESORT_MIN = 120;
/** A stop this close to an earlier one, reached by a detour longer than
 *  RETURN_DETOUR_KM, brings the day back across town (validate, below). */
export const RETURN_NEAR_M = 600;
const RETURN_DETOUR_KM = 1.5;
/** A chosen stop the finished day goes this far out of its way for, off the
 *  line between the stops either side, is dropped (validate, below). Wider
 *  than growing's bar: a walking loop (Takeshita Street > Shinjuku Gyoen >
 *  Shibuya, 3.3 km) is a loop, not a trip across town. */
const DETOUR_DROP_KM = 3.5;
/** Extra validation passes a day may spend refilling after such drops. */
const DETOUR_PASSES_MAX = 6;
/** Runs of up to this many chosen stops count as one trip out, at the bar
 *  for each stop (two stops, 7 km): Togetsukyo >
 *  Nijo Castle > the Kamo river > back to Kinkaku-ji. */
const DETOUR_RUN_MAX = 2;
/** No chosen daytime stop ends after this (an evening place may). */
const DAY_END_LATEST = 19 * 60;
/** The 09:00 start a day's end is measured from (`usualDayStart`). */
const USUAL_LATE_START = 9 * 60;

/** A best window starting at or after this is the evening. */
const EVENING_FROM = 17 * 60;
/** An unpinned evening place goes in only when the day reaches this close
 *  to its window by itself; a pinned one waits as long as it takes. */
export const EVENING_WAIT_MAX = 60;
/** A pinned evening stop the day waits longer than this for gets a note. */
const FREE_TIME_NOTE_MIN = 120;

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** When a place's evening best time starts, if every best window it has is
 *  "after" a time in the evening ("after 17:30"). Null for any other place,
 *  a dawn-or-dusk one (Fushimi Inari) included. A soft preference on its
 *  own: it times a pinned stop, nothing else. */
export function eveningWindow(p: PlaceInput): number | null {
  if (!p.bestWindow.length) return null;
  const wins = p.bestWindow.map(parseWindow);
  if (!wins.every((w) => w.after != null && w.after >= EVENING_FROM)) return null;
  return Math.min(...wins.map((w) => w.after!));
}

/** When an evening-only place can start: one flagged so (`eveningOnly`, its
 *  own notes say it is dead or closed by day: Pontocho), or one that opens
 *  at 17:00 or later (Golden Gai). Its evening window, or its opening if
 *  later. Null for every other place: an evening best window alone (Gion,
 *  Umeda Sky) doesn't make a place evening-only. */
export function eveningFrom(p: PlaceInput): number | null {
  const opens = parseClock(p.opensAt);
  if (!p.eveningOnly && (opens == null || opens < EVENING_FROM)) return null;
  return Math.max(eveningWindow(p) ?? EVENING_FROM, opens ?? 0);
}

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

/** When a chosen daytime stop must end: a 09:00 start, the pace's time
 *  and an hour for lunch, or later for a later start, never after 19:00:
 *  relaxed 16:00, standard 18:00, packed 19:00. An early riser starts
 *  early to beat the crowds, not to finish early; a travel day starts
 *  later by the move and has that much less time, so it ends as any day. */
export function dayEndFor(dayStartMin: number, pace: TravellerInput["pace"], moveMin = 0): number {
  const budgetMin = Math.max(0, DAY_BUDGET_MINUTES[pace] - moveMin);
  return Math.min(DAY_END_LATEST, Math.max(dayStartMin + budgetMin, USUAL_LATE_START + DAY_BUDGET_MINUTES[pace]) + LUNCH_MIN);
}

/** Has a position to measure the day's shape by. */
const hasPoint = (p: PlaceInput) => p.lat != null && p.lon != null;

/** Is a stop `direct` km from an earlier one, by `path` km through the
 *  stops between, a return to it? Back within RETURN_NEAR_M (or within a
 *  quarter of the way round, across a city: Kappabashi, 700 m from
 *  Senso-ji after Kabuki-za), by a detour of over RETURN_DETOUR_KM. */
export function isReturnKm(direct: number, path: number): boolean {
  return direct <= Math.max(RETURN_NEAR_M / 1000, path / 4) && path - direct > RETURN_DETOUR_KM;
}

/** Would a stop at `at` in `seq` take the day out of its way? Between two
 *  stops: a detour of over RETURN_DETOUR_KM off the straight line between
 *  them (Kyoto Tower between Yasaka Shrine and Gion). At the day's end: back
 *  to an area the day already left, away from where it is now (Kappabashi
 *  after Kabuki-za, beside Senso-ji where the day began). The planner's
 *  growth rule; `fitPlace` uses it for a place the traveller adds. */
export function straysAt(
  seq: ReadonlyArray<{ place: PlaceInput; locked: boolean }>,
  p: PlaceInput,
  at: number,
  km: (a: PlaceInput, b: PlaceInput) => number = (a, b) => (metresBetween(a, b) ?? 0) / 1000,
): boolean {
  const isReturn = isReturnKm;
  if (!hasPoint(p)) return false;
  const prev = seq[at - 1]?.place;
  const next = seq[at]?.place;
  if (prev && next) return km(prev, p) + km(p, next) - km(prev, next) > RETURN_DETOUR_KM;
  const near = RETURN_NEAR_M / 1000;
  if (prev) {
    if (km(prev, p) <= near) return false;
    for (let i = 0; i < at - 1; i++) {
      if (!hasPoint(seq[i].place)) continue;
      let path = km(prev, p);
      for (let j = i; j < at - 1; j++) path += km(seq[j].place, seq[j + 1].place);
      if (isReturn(km(seq[i].place, p), path)) return true;
    }
    return false;
  }
  // At the day's start, the same the other way round: not where the day
  // will come back to after leaving (Tsukiji before Senso-ji, when Kabuki-za
  // beside Tsukiji is pinned after it).
  if (!next || km(p, next) <= near) return false;
  // Nor across town from a pin the day opens with: the pin is where the
  // traveller chose to be (Nijo Castle before Kiyomizu-dera, on a day of
  // the east bank).
  if (seq[at].locked && km(p, next) > RETURN_DETOUR_KM) return true;
  for (let k = at + 1; k < seq.length; k++) {
    if (!hasPoint(seq[k].place)) continue;
    let path = km(p, next);
    for (let j = at; j < k; j++) path += km(seq[j].place, seq[j + 1].place);
    if (isReturn(km(seq[k].place, p), path)) return true;
  }
  return false;
}

/** When a stop is an evening stop, the clock time it starts: an
 *  evening-only place (or, pinned without a time, one whose best windows are
 *  all evening) whose visit fits between its evening and closing. Null for
 *  any other stop. Such a stop ends the day wherever the day began, so the
 *  way rule (`straysAt`) doesn't apply to it. */
export function eveningStartOf(p: PlaceInput, durationMin: number, lockedStart: number | null = null, locked = false): number | null {
  if (lockedStart != null) return null;
  const from = eveningFrom(p) ?? (locked ? eveningWindow(p) : null);
  if (from == null) return null;
  const at = Math.max(from, parseClock(p.opensAt) ?? 0);
  return at + durationMin <= (parseClock(p.closesAt) ?? 24 * 60) ? at : null;
}

/** The day's usual start: 07:00 for a crowd-avoider, else 09:00. */
export function usualDayStart(crowdTolerance: number): number {
  return crowdTolerance < 0.35 ? 7 * 60 : 9 * 60;
}

/** Scheduler, §05 Fig. 2. Greedy insertion with local search — not
 *  optimal, and it does not need to be. It needs to be right, fast, and
 *  explainable: every item carries the terms that put it there, and every
 *  place left out carries the rule or term that removed it. */
export function planDay(input: DayInput): DayPlan {
  const { date, cityId, traveller: t, travel } = input;
  // A hike closes at dusk (`daylightEndMin`): from here on its closing time
  // is the earlier of its own and that, so every hours check (growth,
  // ordering, timing, validation) keeps it in daylight.
  const daylight = new Map<string, number>();
  const places = input.places.map((p) => {
    const end = daylightEndMin(p, date);
    const own = parseClock(p.closesAt);
    if (end == null || (own != null && own <= end)) return p;
    daylight.set(p.id, end);
    return { ...p, closesAt: clock(end) };
  });
  const w: Weights = { ...DEFAULT_WEIGHTS, ...input.weights };
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = day.getUTCDay();

  // 1 BUDGET
  // A travel day starts once the traveller is in the new city, and ends
  // when any day would: the move comes out of the day's time. A start given
  // as a clock time (a re-plan keeping its start, "start at 10:00") is
  // taken as it is; the move still comes out of the day.
  const moveMin = input.move?.minutes ?? 0;
  const budgetMin = Math.max(0, DAY_BUDGET_MINUTES[t.pace] - moveMin);
  const arriveMin = usualDayStart(t.crowdTolerance) + moveMin;
  const dayStart = input.dayStartMin ?? arriveMin;
  // The day grows until its time is spent: relaxed holds fewer stops
  // because its visits are the full ones and its budget the shortest. On a
  // long stay it takes no more than its share of the places left (below).
  let maxItems = input.maxItems ?? MAX_STOPS;
  // When a chosen daytime stop must end (`dayEndFor`).
  const dayEndMin = dayEndFor(dayStart, t.pace, moveMin);

  const considered: Rejected[] = [];
  const warnings: string[] = [];
  if (input.move && input.move.trainMin == null) warnings.push(copy.plan.warnings.moveUnknown(input.move.minutes));
  // A start the traveller named, before the move lets them arrive.
  if (input.move && dayStart < arriveMin) warnings.push(copy.plan.warnings.beforeArrival(clock(dayStart), clock(toFive(arriveMin))));
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
    if (r && lockedIds.has(p.id))
      warnings.push(r.term === "many_closed"
        ? copy.plan.warnings.manyClosed(p.name, (copy.plan.weekdays as Record<number, string>)[weekday])
        : copy.plan.warnings.pinnedAnyway(p.name, r.detail));
    pool.push(p);
  }
  // A long stay's share: this day's part of the days left (a travel day
  // counts for what its move leaves), never thinner than a relaxed day
  // (about four stops).
  const ownShare = budgetMin / DAY_BUDGET_MINUTES[t.pace];
  const daysLeft = input.cityDaysLeft ?? ownShare;
  if (input.maxItems == null && daysLeft > ownShare) maxItems = Math.min(maxItems, Math.max(lockedIds.size, SHARE_FLOOR, Math.floor((pool.length * ownShare) / daysLeft)));

  // Travel, with an honest fallback. Growing and ordering price legs to
  // places that never make the day, so a fallback leg warns only when the
  // returned day travels it (`time` below), never when it is priced.
  const tmemo = new Map<string, TravelLeg>();
  const fallbackLegs = new Set<TravelLeg>();
  const legBetween = (a: PlaceInput, b: PlaceInput): TravelLeg => {
    const k = `${a.id}>${b.id}`;
    const hit = tmemo.get(k);
    if (hit) return hit;
    let leg = travel(a, b);
    if (!leg) {
      leg = { mode: "estimate", minutes: FALLBACK_TRAVEL_MIN, fareJpy: 0, fareKind: "estimate",
        detail: copy.plan.warnings.noTrainData(FALLBACK_TRAVEL_MIN, a.name, b.name), lines: [] };
      fallbackLegs.add(leg);
    }
    tmemo.set(k, leg);
    return leg;
  };
  /** What a fallback leg of the day says: which end has no station, or
   *  that two stations have no route between them. */
  const fallbackWarnings = (a: PlaceInput, b: PlaceInput): string[] => {
    const out: string[] = [];
    for (const p of [a, b]) if (!p.nearestStation) out.push(copy.plan.warnings.noStation(p.name, FALLBACK_TRAVEL_MIN));
    if (a.nearestStation && b.nearestStation) out.push(copy.plan.warnings.noRoute(a.nearestStation, b.nearestStation, FALLBACK_TRAVEL_MIN));
    return out;
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
  const ctx = (): ScoreContext => ({ categoryCounts: categoryCounts(), remainingMin: remaining(), date, earlyStart });

  const draftOf = (p: PlaceInput, locked = false, lockedStart: number | null = null): Draft => ({
    place: p,
    durationMin: chooseDuration(p, t.pace) ?? p.durationTypicalMin ?? 60,
    locked,
    anchored: false,
    lockedStart,
    score: scorePlace(p, t, ctx(), w),
    alternatives: [],
  });

  /** The evening floor of a stop: when an evening-only place
   *  (`eveningFrom`), or an untimed pin whose best windows are all evening
   *  (`eveningWindow`: Dotonbori as a must-see), starts at the earliest, if
   *  its visit fits before it closes. Null for any other stop, and for a
   *  pin with a time of its own. */
  const eveningStart = eveningStartOf;
  const eveningOf = (d: Draft) => eveningStart(d.place, d.durationMin, d.lockedStart, d.locked);
  const isEvening = (d: Draft) => eveningOf(d) != null;
  /** A stop held to the day: neither evening (above) nor one whose best
   *  windows are all evening, which may go by day or after an evening stop
   *  (Hozenji, a minute from Dotonbori). */
  const byDayOnly = (p: PlaceInput, d?: Draft) => (d ? !isEvening(d) : eveningStart(p, chooseDuration(p, t.pace) ?? 60) == null) && eveningWindow(p) == null;

  // Pinned items go in first and are never moved or dropped (§08). An
  // untimed evening pin goes after the untimed others: the day reaches the
  // evening last.
  for (const l of input.locked ?? []) {
    const p = byId.get(l.placeId);
    if (!p) { warnings.push(copy.plan.warnings.pinnedMissing(l.placeId)); continue; }
    seq.push(draftOf(p, true, l.startMin ?? null));
  }
  seq.sort((a, b) => (a.lockedStart ?? Infinity) - (b.lockedStart ?? Infinity) || Number(isEvening(a)) - Number(isEvening(b)));

  const placed = () => new Set(seq.map((d) => d.place.id));
  const rejectedIds = () => new Set(considered.map((r) => r.placeId));

  const conflictWith = (p: PlaceInput): PlaceInput | undefined =>
    seq.map((d) => d.place).find((q) => p.conflictsWith.includes(q.id) || q.conflictsWith.includes(p.id));

  // 3 ANCHOR — the highest-scoring place with a morning window, for an early
  // riser; otherwise simply the highest-scoring place.
  // An evening place never opens the day.
  if (seq.length === 0) {
    const scored = pool.filter((p) => eveningStart(p, draftOf(p).durationMin) == null).map((p) => {
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

  /** Pins a timing reaches after closing, or after the time they're pinned for. */
  const latePinsOf = (tm: ReturnType<typeof time>) => new Set([
    ...tm.violations.filter((v) => seq.some((d) => d.locked && d.place.id === v.placeId)).map((v) => v.placeId),
    ...tm.items.filter((i) => seq.some((d) => d.place.id === i.placeId && d.lockedStart != null && i.startMin > d.lockedStart)).map((i) => i.placeId),
  ]);

  // ---- the day's shape, in straight lines between places' positions. A
  // place without one has no shape to break (0 km).
  const kmMemo = new Map<string, number>();
  const km = (a: PlaceInput, b: PlaceInput): number => {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    let v = kmMemo.get(key);
    if (v == null) { v = (metresBetween(a, b) ?? 0) / 1000; kmMemo.set(key, v); }
    return v;
  };
  const isReturn = isReturnKm;
  /** `straysAt`, on the day as it stands now. */
  const strays = (p: PlaceInput, at: number): boolean => straysAt(seq, p, at, km);
  /** Where a day comes back to an area it left: a stop within RETURN_NEAR_M
   *  of an earlier one, reached by a detour of over RETURN_DETOUR_KM through
   *  the stops between. Not when a pin lies between them (the pins made
   *  the day cross town; `acrossPins` counts those too), nor a return to
   *  an evening stop in its evening (the day ends there wherever it
   *  began). One per returning stop. */
  const returnsOf = (s: Draft[], tm: ReturnType<typeof time>, acrossPins = false): { i: number; k: number }[] => {
    const starts = new Map(tm.items.map((it) => [it.placeId, it.startMin]));
    const out: { i: number; k: number }[] = [];
    for (let k = 2; k < s.length; k++) {
      if (!hasPoint(s[k].place)) continue;
      const from = eveningOf(s[k]) ?? eveningWindow(s[k].place);
      if (from != null && (starts.get(s[k].place.id) ?? 0) >= from) continue;
      for (let i = 0; i < k - 1; i++) {
        if (!hasPoint(s[i].place)) continue;
        if (!acrossPins && s.slice(i + 1, k).some((d) => d.locked)) continue;
        let path = 0;
        for (let j = i; j < k; j++) path += km(s[j].place, s[j + 1].place);
        if (isReturn(km(s[i].place, s[k].place), path)) { out.push({ i, k }); break; }
      }
    }
    return out;
  };

  /** The planner's own stops a day goes more than DETOUR_DROP_KM out of
   *  its way for, off the line between the stops either side, worst first.
   *  A pin is where the traveller chose to be, so never one. */
  const offWayOf = (s: Draft[]): Draft[] => {
    const out: { d: Draft; excess: number }[] = [];
    for (let k = 1; k + 1 < s.length; k++)
      for (let w = 1; w <= DETOUR_RUN_MAX && k + w < s.length; w++) {
        const run = s.slice(k, k + w);
        const a = s[k - 1].place;
        const b = s[k + w].place;
        if (run.some((d) => d.locked || d.anchored || !hasPoint(d.place)) || !hasPoint(a) || !hasPoint(b)) break;
        const pts = [a, ...run.map((d) => d.place), b];
        let path = 0;
        for (let j = 0; j + 1 < pts.length; j++) path += km(pts[j], pts[j + 1]);
        const excess = path - km(a, b);
        if (excess <= DETOUR_DROP_KM * w) continue;
        // The stop of the run whose leaving shortens the way most.
        let best = run[0];
        let gain = -1;
        run.forEach((d, j) => {
          const g = km(pts[j], d.place) + km(d.place, pts[j + 2]) - km(pts[j], pts[j + 2]);
          if (g > gain) { gain = g; best = d; }
        });
        out.push({ d: best, excess });
      }
    return out.sort((x, y) => y.excess - x.excess).map((x) => x.d);
  };

  // 4 GROW — insert the candidate with the best marginal (score minus the
  // travel it adds) until the budget is spent or nothing is worth adding.
  // Where a stop may go: a daytime one before the first evening stop, an
  // evening one after the last daytime stop (and never before the anchor).
  const spotsFor = (p: PlaceInput, duration: number): [number, number] => {
    const first = seq[0]?.anchored ? 1 : 0;
    const firstEve = seq.findIndex(isEvening);
    if (eveningStart(p, duration) == null) {
      if (!byDayOnly(p)) return [first, seq.length];
      return [first, firstEve < 0 ? seq.length : Math.max(first, firstEve)];
    }
    let lastDay = -1;
    seq.forEach((d, i) => { if (byDayOnly(d.place, d)) lastDay = i; });
    return [Math.max(first, lastDay + 1), seq.length];
  };
  const grow = () => {
    // Evening places the day did not reach, said once growing stops.
    const eveningSkips = new Map<string, Rejected>();
    // What an earlier pass left out for want of time, or for a stop since
    // dropped, gets another look: a refill has the time the drop freed.
    for (let i = considered.length - 1; i >= 0; i--) if (considered[i].stage === "grow" || considered[i].stage === "conflict") considered.splice(i, 1);
    growLoop(eveningSkips);
    const done = placed();
    for (const r of eveningSkips.values()) if (!done.has(r.placeId) && !rejectedIds().has(r.placeId)) considered.push(r);
  };
  const growLoop = (eveningSkips: Map<string, Rejected>) => {
    for (;;) {
      // Skips seen before the last stop went in are stale: say them only
      // when growing stops because nothing else is worth adding.
      eveningSkips.clear();
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
            detail: copy.plan.leftOut.clash(clash.name) });
          continue;
        }
        const duration = chooseDuration(p, t.pace)!;
        const sc = scorePlace(p, t, ctx(), w);
        let best: Option | null = null;
        // The anchor opened the day for a reason; nothing goes in front of it.
        const [lo, hi] = spotsFor(p, duration);
        for (let at = lo; at <= hi; at++) {
          const prev = seq[at - 1]?.place;
          const next = seq[at]?.place;
          const dTravel = tmin(prev, p) + tmin(p, next) - tmin(prev, next);
          const marginal = sc.total - w.travelPerHalfHour * (dTravel / 30);
          if (!best || marginal > best.marginal) best = { p, at, dTravel, score: sc, marginal, duration };
        }
        if (best) options.push(best);
      }

      const fits = options.filter((o) => o.duration + o.dTravel <= rem);
      // An evening place goes in only where the day reaches its evening by
      // itself (within EVENING_WAIT_MAX): not by day, not after a long gap.
      // Its cheapest spot that does (after an evening pin, say), if any.
      const atEvening = (o: Option): Option | null => {
        const from = eveningStart(o.p, o.duration);
        if (from == null) return o;
        const [lo, hi] = spotsFor(o.p, o.duration);
        let best: Option | null = null;
        for (let at = lo; at <= hi; at++) {
          const prev = seq[at - 1]?.place;
          const next = seq[at]?.place;
          const dTravel = tmin(prev, o.p) + tmin(o.p, next) - tmin(prev, next);
          if (best && dTravel >= best.dTravel) continue;
          const saved = seq;
          seq = [...seq.slice(0, at), draftOf(o.p), ...seq.slice(at)];
          const arrive = time(true).arrivals.get(o.p.id) ?? 0;
          seq = saved;
          if (arrive >= from - EVENING_WAIT_MAX) best = { ...o, at, dTravel, marginal: o.score.total - w.travelPerHalfHour * (dTravel / 30) };
        }
        if (!best) eveningSkips.set(o.p.id, { placeId: o.p.id, name: o.p.name, stage: "grow", term: "best_window", detail: copy.plan.leftOut.eveningOnly(clock(eveningFrom(o.p)!)) });
        return best;
      };
      const ranked = fits.filter((o) => o.marginal > 0).map(atEvening).filter((o): o is Option => o != null)
        .filter((o) => o.marginal > 0 && o.duration + o.dTravel <= rem).sort((a, b) => b.marginal - a.marginal);
      // A stop must fit the clock: not make a pin late, not leave itself or
      // another chosen stop past closing, and not keep the day waiting long
      // for it to open. Try the best-ranked place at its best spot, then its
      // other spots, then the next place. Adding stops only makes the day
      // later, so a place that fits no spot now is left out for this pass;
      // one that only opens too late for now is tried again.
      let winner: Option | undefined;
      const clockSkips: Rejected[] = [];
      const tooEarly: Rejected[] = [];
      // The best place that fits only with a wait: chosen when nothing
      // fits without one (an early start before anything near opens).
      let patient: Option | undefined;
      let patientWait = Infinity;
      if (ranked.length) {
        const now = time(true);
        const misfit = (tm: ReturnType<typeof time>) => tm.violations.filter((v) => !isLocked(v.placeId));
        const lateBefore = latePinsOf(now);
        const misfitBefore = new Set(misfit(now).map((v) => v.placeId));
        const offWayNow = new Set(offWayOf(seq).map((d) => d.place.id));
        for (const o of ranked) {
          const [first, last] = spotsFor(o.p, o.duration);
          const spots = [o.at, ...Array.from({ length: last + 1 - first }, (_, i) => i + first).filter((at) => at !== o.at)];
          let madeLate: string | null = null;
          // Why it fits nowhere: its own hours, else the stop it would push
          // past closing.
          let own: Rejected | null = null;
          let pushed: string | null = null;
          let waited: number | null = null;
          let strayed = false;
          for (const at of spots) {
            const prev = seq[at - 1]?.place;
            const next = seq[at]?.place;
            const dTravel = tmin(prev, o.p) + tmin(o.p, next) - tmin(prev, next);
            // Another spot can cost more travel than the time left.
            if (o.duration + dTravel > rem) continue;
            // A fuller day has time to wander: a stop goes only where it is
            // on the day's way, never out and back again.
            // (Not an evening place: the day ends there, wherever it began.)
            if (eveningStart(o.p, o.duration) == null && strays(o.p, at)) { strayed = true; continue; }
            // Nor where it would itself be off the day's way as validation
            // counts it (`offWayOf`, a run of two included): at the day's
            // start or end `strays` looks one way only, so the Fushimi sake
            // district after Arashiyama, then the Philosopher's Path after
            // it, each passed. A neighbour it leaves off the way is
            // validation's to drop and refill.
            if (offWayOf([...seq.slice(0, at), draftOf(o.p), ...seq.slice(at)]).some((d) => d.place.id === o.p.id && !offWayNow.has(d.place.id))) { strayed = true; continue; }
            const saved = seq;
            seq = [...seq.slice(0, at), draftOf(o.p), ...seq.slice(at)];
            const trial = time(true);
            seq = saved;
            const late = [...latePinsOf(trial)].find((id) => !lateBefore.has(id));
            const bad = misfit(trial).filter((v) => !misfitBefore.has(v.placeId));
            // Waiting isn't in the budget, so a late opener would stretch
            // the day, not fill it.
            const wait = trial.waits.get(o.p.id) ?? 0;
            if (!late && !bad.length && wait <= OPEN_WAIT_MAX_MIN) {
              winner = { ...o, at, dTravel };
              break;
            }
            if (late) madeLate ??= late;
            own ??= bad.find((v) => v.placeId === o.p.id) ?? null;
            pushed ??= bad.find((v) => v.placeId !== o.p.id)?.name ?? null;
            if (!late && !bad.length) {
              waited = Math.min(waited ?? Infinity, wait);
              // The best-ranked place that fits with a wait is the one kept,
              // at its spot with the shortest wait; a lower-ranked place
              // never takes its turn, even with a shorter wait.
              if (wait <= OPEN_WAIT_LAST_RESORT_MIN && (!patient || (patient.p === o.p && wait < patientWait))) {
                patient = { ...o, at, dTravel };
                patientWait = wait;
              }
            }
          }
          if (winner) break;
          // Its own hours first, then opening too late for now, then the pin
          // or stop it would make late.
          const skip = (detail: string): Rejected => ({ placeId: o.p.id, name: o.p.name, stage: "grow", term: "hours", detail });
          if (own) clockSkips.push(skip(own.detail));
          else if (waited != null) tooEarly.push(skip(copy.plan.leftOut.opensLater(clock(parseClock(o.p.opensAt)!), waited)));
          else if (madeLate) clockSkips.push(skip(copy.plan.leftOut.makesPinLate(seq.find((d) => d.place.id === madeLate)?.place.name ?? madeLate)));
          else if (pushed) clockSkips.push(skip(copy.plan.leftOut.makesPinLate(pushed)));
          // Out of the way only for now: the day may come its way as it fills.
          else if (strayed) tooEarly.push({ placeId: o.p.id, name: o.p.name, stage: "grow", term: "travel", detail: copy.plan.leftOut.outOfWay });
        }
      }
      considered.push(...clockSkips);
      winner ??= patient;

      if (!winner) {
        considered.push(...tooEarly);
        // Nothing worth adding. Say why, per candidate, once.
        for (const o of options) {
          if (rejectedIds().has(o.p.id) || eveningSkips.has(o.p.id)) continue;
          if (o.duration + o.dTravel > rem) {
            considered.push({ placeId: o.p.id, name: o.p.name, stage: "grow", term: "no_time",
              detail: copy.plan.leftOut.noTime(o.duration, o.dTravel, Math.max(0, rem)) });
          } else {
            const worst = [...o.score.terms].sort((a, b) => a.contribution - b.contribution)[0];
            const far = o.dTravel >= 30 ? copy.plan.leftOut.far(o.dTravel) : null;
            considered.push({ placeId: o.p.id, name: o.p.name, stage: "grow", term: far ? "travel" : worst.term,
              detail: far ?? worst.clause ?? copy.plan.leftOut.lowScore(o.score.total.toFixed(1)) });
          }
        }
        break;
      }

      const chosen = winner;
      const d = draftOf(chosen.p);
      d.score = chosen.score;
      d.alternatives = ranked.filter((o) => o.p !== chosen.p).slice(0, 3).map((o) => ({
        placeId: o.p.id, name: o.p.name, score: o.marginal,
        whyNot: o.dTravel > chosen.dTravel + 15
          ? copy.plan.leftOut.further(o.dTravel - chosen.dTravel)
          : copy.plan.leftOut.slightlyLower([...o.score.terms].sort((a, b) => a.contribution - b.contribution)[0].term.replace(/_/g, " ")),
      }));
      seq.splice(chosen.at, 0, d);
    }
  };

  // 5 ORDER — 2-opt over unpinned runs, then or-opt: runs of chosen stops
  // moved past pins, which keep their order. The objective is travel plus a
  // charge for every busy place that would miss its quiet window, so a
  // "before 08:00" shrine is not shuffled to midday just to save a hop.
  const WINDOW_MISS_MIN = 30;
  // And a whole day's travel for a stop reached too late to finish before
  // it closes, so no reordering trades a stop's hours for a shorter route.
  const CLOSED_MIN = 24 * 60;
  // A shorter route that reaches a pin late is not better. Nor is one that
  // undoes what growing fitted: a chosen stop past closing, or more travel
  // than the day has time for (the window charge can trade travel for a
  // quiet hour).
  // Nor one that comes back across town, or keeps the day waiting longer
  // than OPEN_WAIT_LAST_RESORT_MIN for a stop to open (Tōshō-gū at 07:00,
  // then Ekie, which opens at 11:00).
  // The day as it stands is timed once per order it is compared with.
  let wasTimed: { s: Draft[]; tm: ReturnType<typeof time>; used: number } | null = null;
  const breaksDay = (was: Draft[]): boolean => {
    const now = seq;
    const used = usedMin();
    const tNow = time(true);
    const after = new Set([...tNow.violations.map((v) => v.placeId), ...latePinsOf(tNow)]);
    seq = was;
    if (wasTimed?.s !== was) wasTimed = { s: was, tm: time(true), used: usedMin() };
    const { tm: tWas, used: usedWas } = wasTimed;
    const before = new Set([...tWas.violations.map((v) => v.placeId), ...latePinsOf(tWas)]);
    seq = now;
    if (used > budgetMin && used > usedWas) return true;
    if ([...after].some((id) => !before.has(id))) return true;
    // Counted across pins too: a reordering never makes a return a pin excuses.
    const backWas = returnsOf(was, tWas, true);
    const backBefore = new Set(backWas.map(({ k }) => was[k].place.id));
    const backNow = returnsOf(now, tNow, true);
    if (backNow.some(({ k }) => !backBefore.has(now[k].place.id))) return true;
    // A chosen daytime stop kept waiting longer than OPEN_WAIT_MAX_MIN for it
    // to open, and longer than before: a wait growing chose (its two-hour
    // fallback) stays, but ordering adds none (Nishiki Market moved first
    // for its quiet morning kept a 09:00 day waiting until 10:00), unless the
    // order takes a return away (round Yokohama's bay and back to Osanbashi),
    // and never one over the fallback's two hours.
    const fewerReturns = backNow.length < backWas.length;
    return now.some((d) => {
      if (d.locked || isEvening(d)) return false;
      const w = tNow.waits.get(d.place.id) ?? 0;
      return w > (fewerReturns ? OPEN_WAIT_LAST_RESORT_MIN : OPEN_WAIT_MAX_MIN) && w > (tWas.waits.get(d.place.id) ?? 0);
    });
  };
  const order = () => {
    // Growing splices into `seq` in place: never compare with a stale timing.
    wasTimed = null;
    const total = () => {
      let travelMin = 0;
      let clockAt = dayStart;
      let miss = 0;
      let late = 0;
      seq.forEach((d, i) => {
        const hop = i ? tmin(seq[i - 1].place, d.place) : 0;
        travelMin += hop;
        clockAt += hop;
        const opens = parseClock(d.place.opensAt) ?? 0;
        if (clockAt < opens) clockAt = opens;
        // An evening stop waits for its evening, so the stops after it are
        // timed from there. One the planner chose may wait an hour at most
        // (EVENING_WAIT_MAX, as growing put it in): a longer wait costs as
        // much as a closed stop.
        const eve = eveningOf(d);
        if (eve != null && clockAt < eve) {
          if (!d.locked && eve - clockAt > EVENING_WAIT_MAX) late++;
          clockAt = eve;
        }
        if ((d.place.crowdLevel ?? 0) >= 0.7 && d.place.bestWindow.length) {
          const ok = d.place.bestWindow.some((win) => {
            const { before, after } = parseWindow(win);
            return (before != null && clockAt <= before) || (after != null && clockAt >= after);
          });
          if (!ok) miss++;
        }
        // Past closing costs more than any route saves: an order that saves
        // a hop by reaching a stop after it shuts would only lose the stop.
        const closes = parseClock(d.place.closesAt);
        if (closes != null && clockAt + d.durationMin > closes) late++;
        clockAt += d.durationMin;
      });
      return travelMin + miss * WINDOW_MISS_MIN + late * CLOSED_MIN;
    };
    // The evening stays last: no reversal (2-opt) or move (or-opt) puts a
    // daytime stop (`byDayOnly`) after an evening one. Counted, so a day that already
    // has one (a pin's own order) isn't frozen.
    const dayAfterEvening = (xs: Draft[]): number => {
      let seen = false;
      let n = 0;
      for (const d of xs) {
        if (isEvening(d)) seen = true;
        else if (seen && byDayOnly(d.place, d)) n++;
      }
      return n;
    };
    const tryOrder = (next: Draft[]): boolean => {
      if (dayAfterEvening(next) > dayAfterEvening(seq)) return false;
      const before = total();
      const saved = seq;
      seq = next;
      if (total() < before && !breaksDay(saved)) return true;
      seq = saved;
      return false;
    };
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 100) {
      improved = false;
      // Reverse a run of chosen stops (2-opt). A run never holds a pin.
      for (let i = 0; i < seq.length - 1; i++) {
        for (let j = i + 1; j < seq.length; j++) {
          if (seq.slice(i, j + 1).some((d) => d.locked || d.anchored)) continue;
          if (tryOrder([...seq.slice(0, i), ...seq.slice(i, j + 1).reverse(), ...seq.slice(j + 1)])) improved = true;
        }
      }
      // Move a run of chosen stops, either way round, anywhere else in the
      // day, past pins too (or-opt). Reversing runs alone can't take a stop
      // across a pin, so a day went museum → Umeda → back to the castle it
      // started beside. Pins keep their order; only the stops the planner
      // chose move, and the anchor keeps the front.
      const first = seq[0]?.anchored ? 1 : 0;
      moves: for (let i = first; i < seq.length; i++) {
        for (let j = i; j < seq.length; j++) {
          if (seq[j].locked || seq[j].anchored) break;
          const run = seq.slice(i, j + 1);
          const rest = [...seq.slice(0, i), ...seq.slice(j + 1)];
          for (let at = first; at <= rest.length; at++) {
            if (at === i) continue;
            for (const r of run.length > 1 ? [run, [...run].reverse()] : [run]) {
              if (tryOrder([...rest.slice(0, at), ...r, ...rest.slice(at)])) {
                improved = true;
                break moves;
              }
            }
          }
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
        // The clock as `time` keeps it: lunch, opening times, earlier pins.
        // A fuller day reaches lunch before most timed pins.
        let clockAt = dayStart;
        let lunch = false;
        const arrive = (m: number) => {
          if (!lunch && m >= LUNCH_EARLIEST && m <= LUNCH_LATEST) { lunch = true; return m + LUNCH_MIN; }
          return m;
        };
        let at = rest.length;
        for (let i = 0; i < rest.length; i++) {
          const d = rest[i];
          const eve = eveningOf(d);
          if (eve != null && pin.lockedStart! < eve) { at = i; break; }
          // An evening stop starts no earlier than its evening.
          const startI = Math.max(arrive(clockAt + tmin(rest[i - 1]?.place, d.place)), eve ?? 0, parseClock(d.place.opensAt) ?? 0, d.lockedStart ?? 0);
          const finishI = startI + d.durationMin;
          const hadLunch: boolean = lunch;
          if (arrive(finishI + tmin(d.place, pin.place)) > pin.lockedStart!) { at = i; break; }
          lunch = hadLunch;
          clockAt = finishI;
        }
        rest = [...rest.slice(0, at), pin, ...rest.slice(at)];
      }
      seq = rest;
    }
  };

  // 6 TIME — clock times from opening hours, transit and a lunch slot.
  // Its warnings are returned, not pushed: it also runs on trial days that
  // are thrown away, and only the day returned may warn. A trial (`lite`)
  // needs only the clock: it skips the scores and reasons.
  const time = (lite = false): { items: PlannedItem[]; meals: Meal[]; violations: Rejected[]; warnings: string[]; endMin: number; fares: number; fareKind: "exact" | "estimate"; unpriced: number; arrivals: Map<string, number>; waits: Map<string, number> } => {
    const items: PlannedItem[] = [];
    /** How long the day waits for each stop to open. */
    const waits = new Map<string, number>();
    /** When each stop is reached, before any wait (lunch, opening, evening). */
    const arrivals = new Map<string, number>();
    const meals: Meal[] = [];
    const violations: Rejected[] = [];
    const warnings: string[] = [];
    let tNow = dayStart;
    let fares = 0;
    let fareKind: "exact" | "estimate" = "exact";
    let unpriced = 0;
    let lunchDone = false;

    seq.forEach((d, i) => {
      const p = d.place;
      let arriveBy: TravelLeg | null = null;
      if (i > 0) {
        arriveBy = legBetween(seq[i - 1].place, p);
        if (fallbackLegs.has(arriveBy))
          for (const msg of fallbackWarnings(seq[i - 1].place, p)) if (!warnings.includes(msg)) warnings.push(msg);
        tNow += arriveBy.minutes;
        fares += arriveBy.fareJpy;
        if (arriveBy.fareKind === "estimate") fareKind = "estimate";
        if (arriveBy.unpricedRides) unpriced += arriveBy.unpricedRides;
      }
      arrivals.set(p.id, tNow);
      if (!lunchDone && tNow >= LUNCH_EARLIEST && tNow <= LUNCH_LATEST) {
        meals.push({ kind: "lunch", startMin: tNow, endMin: tNow + LUNCH_MIN });
        tNow += LUNCH_MIN;
        lunchDone = true;
      }
      const opens = parseClock(p.opensAt) ?? 0;
      const closes = parseClock(p.closesAt) ?? 24 * 60;
      const extra: string[] = [];
      const evening = eveningOf(d);
      if (evening != null) {
        // Lunch before the wait for the evening, never after it.
        if (!lunchDone && tNow < evening) {
          const at = Math.max(tNow, LUNCH_EARLIEST);
          meals.push({ kind: "lunch", startMin: at, endMin: at + LUNCH_MIN });
          tNow = at + LUNCH_MIN;
          lunchDone = true;
        }
        // A long wait for a pinned evening stop is free time: say so.
        if (d.locked && evening - tNow > FREE_TIME_NOTE_MIN) warnings.push(copy.plan.warnings.freeTime(clock(evening), p.name));
        tNow = Math.max(tNow, evening);
      } else {
        const want = d.locked && d.lockedStart == null ? eveningFrom(p) ?? eveningWindow(p) : null;
        if (want != null && p.closesAt) warnings.push(copy.plan.warnings.eveningMissed(p.name, clock(want), clock(closes)));
      }
      if (tNow < opens) {
        const wait = opens - tNow;
        waits.set(p.id, wait);
        extra.push(wait > 20 ? copy.plan.reasons.opensAt(clock(opens)) : copy.plan.reasons.opensAtWait(clock(opens)));
        if (wait > 20) warnings.push(copy.plan.warnings.opensLate(p.name, clock(opens), wait));
        tNow = opens;
      }

      // The score that explains this item is the one against the day as
      // finally ordered: "your third temple" must be the third one shown.
      if (!lite) {
        const before = new Map<string, number>();
        let usedBefore = 0;
        for (let k = 0; k < i; k++) {
          before.set(seq[k].place.category, (before.get(seq[k].place.category) ?? 0) + 1);
          usedBefore += seq[k].durationMin + (k ? tmin(seq[k - 1].place, seq[k].place) : 0);
        }
        d.score = scorePlace(p, t, { categoryCounts: before, remainingMin: budgetMin - usedBefore, date, earlyStart }, w);
      }
      if (d.lockedStart != null) {
        if (tNow > d.lockedStart) warnings.push(copy.plan.warnings.pinnedLate(p.name, clock(d.lockedStart), clock(tNow)));
        else tNow = d.lockedStart;
      }
      const startMin = tNow;
      const endMin = startMin + d.durationMin;

      if (endMin > closes) {
        violations.push({ placeId: p.id, name: p.name, stage: "validate", term: "hours",
          detail: daylight.has(p.id) ? copy.plan.leftOut.afterDark(clock(closes)) : copy.plan.leftOut.closesBefore(clock(closes), clock(startMin), d.durationMin) });
      } else if (!d.locked && evening == null && endMin > dayEndMin) {
        // A chosen daytime stop ends by the day's end; an evening place, or
        // one with an evening window it is in, may run later.
        const win = eveningWindow(p);
        if (win == null || startMin < win) violations.push({ placeId: p.id, name: p.name, stage: "validate", term: "day_end", detail: copy.plan.leftOut.pastDayEnd(clock(dayEndMin)) });
      }

      if (lite) {
        items.push({ placeId: p.id, name: p.name, category: p.category, startMin, endMin, durationMin: d.durationMin, locked: d.locked,
          score: d.score, reason: "", reasonTerms: [], arriveBy, alternatives: d.alternatives, costJpy: p.costJpy ?? 0 });
        tNow = endMin;
        return;
      }
      // Window clauses: the honest version of "go early".
      const wins = p.bestWindow.map(parseWindow).filter((x) => x.before != null || x.after != null);
      if (evening != null) {
        extra.push(copy.plan.reasons.evening);
      } else {
        let hit = false;
        for (const { before, after } of wins) {
          if (before != null && startMin <= before) { extra.push(copy.plan.reasons.beforeCrowd(clock(startMin))); hit = true; }
          if (after != null && startMin >= after) { extra.push(copy.plan.reasons.afterCrowd(clock(after))); hit = true; }
        }
        if (!hit && wins.some((x) => x.before != null) && (p.crowdLevel ?? 0) >= 0.8) {
          // "Unavoidable" only when no start on this day is in a window:
          // the day can't start before a "before" one (a travel day, or a
          // start the traveller named, is fixed; otherwise, a re-plan's kept
          // start included, an early start would do), and an "after" one
          // closes too soon to visit.
          const fixed = input.move != null || input.startNamed === true;
          const earliest = Math.max(opens, fixed ? dayStart : Math.min(dayStart, usualDayStart(0)));
          const reachable = wins.some(({ before, after }) =>
            (before != null && earliest <= before) || (after != null && Math.max(after, opens) + d.durationMin <= closes));
          extra.push(reachable
            ? copy.plan.reasons.busyNow(wins.map(({ before, after }) => before != null ? copy.plan.window.before(clock(before)) : copy.plan.window.after(clock(after!))).join(copy.plan.or))
            : copy.plan.reasons.busiestHour);
        }
      }

      // The ticket, said on the stop itself: the vault raises a recommended
      // booking only inside its lead time, so a day planned weeks ahead
      // would otherwise never say it. A performance starts when it starts.
      if (p.bookingReq === "recommended") extra.push(copy.plan.reasons.bookAhead(p.bookingLeadDays));
      if (p.category === "performance") extra.push(copy.plan.reasons.setTimes);
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
    return { items, meals, violations, warnings, endMin: tNow, fares, fareKind, unpriced, arrivals, waits };
  };

  // 7 VALIDATE — drop what the hours reject, refill, re-time. Bounded.
  let timed: ReturnType<typeof time> = { items: [], meals: [], violations: [], warnings: [], endMin: dayStart, fares: 0, fareKind: "exact", unpriced: 0, arrivals: new Map(), waits: new Map() };
  const isLocked = (id: string) => seq.find((d) => d.place.id === id)?.locked === true;
  const unlockedViolations = () => timed.violations.filter((v) => !isLocked(v.placeId));
  // A pin is never dropped, so when one is reached after closing, a stop
  // the planner chose before it goes instead (one per pass): the pin was
  // the traveller's choice, the stop was ours. Only when that helps: a pin
  // whose start is fixed (its own time, its opening time, the pin before
  // it) or whose visit is longer than its hours is late whatever we drop.
  const pinDrop = (): Rejected[] => {
    const lateIds = new Set(timed.violations.filter((v) => isLocked(v.placeId)).map((v) => v.placeId));
    for (let at = 0; at < seq.length; at++) {
      const pin = seq[at];
      if (!pin.locked || !lateIds.has(pin.place.id)) continue;
      const item = timed.items.find((i) => i.placeId === pin.place.id);
      if (!item) continue;
      let prevPin = -1;
      for (let k = at - 1; k >= 0; k--) if (seq[k].locked) { prevPin = k; break; }
      const prevEnd = prevPin >= 0 ? timed.items.find((i) => i.placeId === seq[prevPin].place.id)?.endMin ?? dayStart : dayStart;
      const floor = Math.max(parseClock(pin.place.opensAt) ?? 0, prevEnd, pin.lockedStart ?? 0);
      const closes = parseClock(pin.place.closesAt) ?? 24 * 60;
      if (item.startMin <= floor || floor + pin.durationMin > closes) continue;
      const before = seq.slice(prevPin + 1, at).filter((d) => !d.locked).pop();
      if (!before) continue;
      // Try it: keep the drop only if the pin really starts earlier.
      const saved = seq;
      seq = seq.filter((d) => d !== before);
      const start = time(true).items.find((i) => i.placeId === pin.place.id)?.startMin ?? item.startMin;
      seq = saved;
      if (start < item.startMin) {
        return [{ placeId: before.place.id, name: before.place.name, stage: "validate", term: "hours", detail: copy.plan.leftOut.makesPinLate(pin.place.name) }];
      }
    }
    return [];
  };
  // An evening stop the planner chose that the finished day reaches more
  // than EVENING_WAIT_MAX before its evening (ordering or a drop moved the
  // day earlier) goes, with the reason growing would have given.
  const eveningWaits = (): Rejected[] => seq.filter((d) => !d.locked).flatMap((d) => {
    const eve = eveningOf(d);
    const arrive = timed.arrivals.get(d.place.id);
    if (eve == null || arrive == null || arrive >= eve - EVENING_WAIT_MAX) return [];
    return [{ placeId: d.place.id, name: d.place.name, stage: "validate", term: "best_window", detail: copy.plan.leftOut.eveningOnly(clock(eveningFrom(d.place)!)) }];
  });
  // A day that leaves an area and comes back to it (`returnsOf`: not across
  // a pin, nor to an evening stop in its evening) loses the stop it came
  // back for, but only when that really takes the return away. Growing
  // keeps stops on the day's way (`strays`) and ordering refuses a new
  // return, so this is a last check.
  const comesBack = (): Rejected[] => {
    const now = returnsOf(seq, timed);
    for (const { i, k } of now) {
      const off = seq[k];
      if (off.locked || off.anchored) continue;
      const saved = seq;
      seq = seq.filter((d) => d !== off);
      const fewer = returnsOf(seq, time(true)).length < now.length;
      seq = saved;
      if (fewer) return [{ placeId: off.place.id, name: off.place.name, stage: "validate", term: "travel", detail: copy.plan.leftOut.comesBack(seq[i].place.name) }];
    }
    return [];
  };
  // A stop the planner chose that the finished day goes out of its way for:
  // more than DETOUR_DROP_KM off the straight line between the stops either
  // side (Tsukiji Hongan-ji between Shinjuku Gyoen and Shibuya, waiting for
  // Shibuya's evening). Growing puts a stop only on the day's way
  // (`strays`), but one that opened or ended the day there can be moved
  // between two others by ordering, or have the day run on past it. The
  // worst goes, one per pass (of a run of two, the stop whose leaving
  // shortens the way most; the next pass looks again), and the refill looks
  // for one on the way. Never a pin.
  const offTheWay = (): Rejected[] => {
    // A day of four stops or fewer (SHARE_FLOOR) keeps them: a long stay's
    // last day holds what is left of the city, scattered, and was stripped
    // to two.
    if (seq.length <= SHARE_FLOOR) return [];
    const worst = offWayOf(seq)[0];
    return worst ? [{ placeId: worst.place.id, name: worst.place.name, stage: "validate", term: "travel", detail: copy.plan.leftOut.outOfWay }] : [];
  };
  // Each such drop earns the day another pass (up to DETOUR_PASSES_MAX), so
  // the refill after it can find a stop on the way: a long stay's last day
  // is what is left of the city, scattered, and without the extra passes it
  // was stripped to three stops.
  let detourPasses = 0;
  let lastOff = false;
  const toDrop = (): Rejected[] => {
    lastOff = false;
    const own = unlockedViolations();
    if (own.length) return own;
    const waits = eveningWaits();
    if (waits.length) return waits;
    const back = comesBack();
    if (back.length) return back;
    const off = offTheWay();
    lastOff = off.length > 0;
    return off.length ? off : pinDrop();
  };
  let stale = false;
  for (let round = 0; round < MAX_VALIDATE_ROUNDS + detourPasses; round++) {
    grow();
    order();
    timed = time();
    stale = false;
    const drop = toDrop();
    if (!drop.length) break;
    considered.push(...drop);
    seq = seq.filter((d) => !drop.some((v) => v.placeId === d.place.id));
    stale = true;
    if (lastOff && detourPasses < DETOUR_PASSES_MAX) detourPasses++;
    // Only a drop for opening hours is what this warns of.
    if (round === MAX_VALIDATE_ROUNDS + detourPasses - 1 && drop.some((v) => v.term === "hours")) warnings.push(copy.plan.warnings.hoursNotFitted);
  }
  // Out of rounds with drops still pending: `timed` was computed before the
  // last drop and still holds the places just rejected — the plan would show
  // a stop the engine itself reported as dropped. Re-time without refilling,
  // and keep dropping until nothing unlocked breaks its hours (re-timing can
  // shift later stops). Bounded by the sequence shrinking every pass.
  while (stale) {
    order();
    timed = time();
    const drop = toDrop();
    stale = drop.length > 0;
    if (stale) {
      considered.push(...drop);
      seq = seq.filter((d) => !drop.some((v) => v.placeId === d.place.id));
    }
  }

  // What the returned day's timing found (never a trial's).
  warnings.push(...timed.warnings);
  // A pinned hike stays even when the day reaches it too late for daylight.
  for (const v of timed.violations)
    if (v.term === "hours" && daylight.has(v.placeId) && isLocked(v.placeId)) warnings.push(copy.plan.warnings.afterDark(v.name, clock(daylight.get(v.placeId)!)));
  if (timed.unpriced) {
    warnings.push(copy.plan.warnings.unpriced(timed.unpriced));
  }
  const activeMin = usedMin();
  const placesJpy = timed.items.reduce((s, i) => s + i.costJpy, 0);

  return {
    date, cityId,
    items: timed.items,
    meals: timed.meals,
    startMin: timed.items[0]?.startMin ?? dayStart,
    endMin: timed.endMin,
    dayStartMin: dayStart,
    dayEndMin,
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
