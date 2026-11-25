/** Does a place the traveller wants fit a day they already have?
 *
 *  "Add a place" on the day box. The traveller chooses the place, so this
 *  makes no choice about WHAT goes in the day; it finds WHERE it fits best
 *  in the traveller's own order and says, from the engine's own rules,
 *  what is true about it there. Nothing new is decided here: the hard rules
 *  are `hardFilter`'s, the clock is `retimeDay`'s, the day's end is
 *  `dayEndFor`'s, the evening rule is `eveningFrom`'s, the detour bar is
 *  the planner's, and the praise is `scorePlace`'s clauses and the
 *  scheduler's timing clauses. If it doesn't fit, the traveller may still
 *  add it, and the day shows its usual warnings. Pure: no network, no model. */
import { DAY_BUDGET_MINUTES } from "@/lib/types";
import { copy } from "@/copy";
import { hardFilter, parseClock, parseWindow } from "./filter";
import { buildReason, chooseDuration, scorePlace } from "./score";
import { FALLBACK_TRAVEL_MIN, retimeDay, type RetimeItem, type RetimedDay } from "./retime";
import { dayEndFor, DETOUR_DROP_KM, eveningFrom, eveningWindow, EVENING_WAIT_MAX, OPEN_WAIT_MAX_MIN, RETURN_NEAR_M } from "./schedule";
import { daylightEndMin } from "./daylight";
import { metresBetween } from "./travel";
import type { PlaceInput, TravelFn, TravellerInput } from "./types";

export interface FitInput {
  /** The day, "YYYY-MM-DD". */
  date: string;
  /** The place to add. */
  place: PlaceInput;
  /** The day as saved, in the traveller's order. */
  items: RetimeItem[];
  /** Every place the day's stops refer to (the candidate is added). */
  places: Map<string, PlaceInput>;
  travel: TravelFn;
  traveller: TravellerInput;
  /** Where the day's clock starts (the same start an edit re-times from). */
  dayStartMin: number;
  /** A travel day's move, in minutes: the day ends as any day would. */
  moveMin?: number;
  /** Places the traveller holds a ticket for on this date (`match.ts`). */
  bookedPlaceIds?: Iterable<string>;
  /** Places already planned on the trip's other days. */
  usedPlaceIds?: Iterable<string>;
  /** Check this spot in the order only, rather than finding the best. */
  at?: number;
}

export interface FitProblem {
  /** The rule, as the planner names it ("closed", "over_day"). */
  term: string;
  /** The reason, in Bento's words (`copy.plan`). */
  text: string;
}

export interface PlaceFit {
  fits: boolean;
  /** Where it goes in the day's order. */
  at: number;
  /** The stop to insert at `at`. An evening place is held at its evening. */
  item: RetimeItem;
  startMin: number;
  endMin: number;
  /** Why it doesn't fit the day as it stands. Empty when it fits. */
  problems: FitProblem[];
  /** What is true and good about it there: at most three clauses. */
  praise: string[];
  /** Things Bento can't check, said either way (a leg it has no route for). */
  notes: string[];
  /** The stop's reason as the planner would store it (`buildReason`). */
  reason: { reason: string; terms: string[] };
  budgetMin: number;
  overByBefore: number;
  overByAfter: number;
}

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dur = copy.time.duration;
const WEEKDAY_OF = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const MAX_PRAISE = 3;
/** Never a stop this length when the place has no duration on record. */
const FALLBACK_VISIT_MIN = 60;

export function fitPlace(input: FitInput): PlaceFit {
  const { date, traveller: t } = input;
  // A hike closes at dusk, as it does for the planner.
  const dusk = daylightEndMin(input.place, date);
  const own = parseClock(input.place.closesAt);
  const place = dusk != null && (own == null || dusk < own) ? { ...input.place, closesAt: clock(dusk) } : input.place;
  const places = new Map(input.places);
  places.set(place.id, place);

  const common: FitProblem[] = [];
  // The hard rules, in the planner's words. "Unverified" and "not covered"
  // never reach here: only verified places in a covered city are offered.
  const rejected = hardFilter(place, t, {
    date,
    weekday: WEEKDAY_OF(date),
    bookedPlaceIds: new Set(input.bookedPlaceIds ?? []),
    usedPlaceIds: new Set(input.usedPlaceIds ?? []),
  });
  if (rejected) common.push({ term: rejected.term, text: rejected.detail });
  // Conflicts, both ways (the Arashiyama trap).
  for (const it of input.items) {
    const q = places.get(it.placeId);
    if (q && (place.conflictsWith.includes(q.id) || q.conflictsWith.includes(place.id))) {
      common.push({ term: "conflicts_with", text: copy.plan.leftOut.clash(q.name) });
    }
  }

  const durationMin = chooseDuration(place, t.pace) ?? FALLBACK_VISIT_MIN;
  const evening = eveningFrom(place);
  const dayEnd = dayEndFor(input.dayStartMin, t.pace, input.moveMin ?? 0);
  const retime = (items: RetimeItem[]) => retimeDay({ items, places, travel: input.travel, pace: t.pace, dayStartMin: input.dayStartMin });
  const before = retime(input.items);

  // Every spot in the traveller's order; an evening place only after the
  // day's other stops, as the planner puts it.
  const spots = input.at != null ? [Math.max(0, Math.min(input.items.length, input.at))]
    : evening != null ? [input.items.length]
    : Array.from({ length: input.items.length + 1 }, (_, i) => i);
  let best: { at: number; item: RetimeItem; after: RetimedDay; problems: FitProblem[]; cost: number } | null = null;
  for (const at of spots) {
    const item = itemFor(at);
    const after = retime([...input.items.slice(0, at), item, ...input.items.slice(at)]);
    const problems = [...common, ...spotProblems(at, after)];
    const cost = problems.length * 100_000 + after.overBy * 10 + (after.activeMin - before.activeMin);
    // A tie goes to the later spot: the end of the day, as a list would.
    if (!best || cost <= best.cost) best = { at, item, after, problems, cost };
  }
  const { at, item, after, problems } = best!;
  const mine = after.items[at];

  return {
    fits: problems.length === 0,
    at,
    item,
    startMin: mine.startMin,
    endMin: mine.endMin,
    problems,
    praise: praiseAt(at, after),
    notes: notesAt(at),
    reason: buildReason(score()),
    budgetMin: before.budgetMin,
    overByBefore: before.overBy,
    overByAfter: after.overBy,
  };

  /** The stop to insert. An evening place the day reaches before its
   *  evening is held there, so re-timing never puts it in the afternoon. */
  function itemFor(at: number): RetimeItem {
    const plain: RetimeItem = { placeId: place.id, durationMin, locked: false, startMin: null };
    if (evening == null) return plain;
    const reached = retime([...input.items.slice(0, at), plain, ...input.items.slice(at)]).items[at].reachedMin;
    return reached < evening ? { ...plain, locked: true, startMin: evening } : plain;
  }

  function spotProblems(at: number, after: RetimedDay): FitProblem[] {
    const out: FitProblem[] = [];
    const mine = after.items[at];
    if (mine.pastClosing) {
      out.push(dusk != null && place.closesAt === clock(dusk)
        ? { term: "after_dark", text: copy.plan.leftOut.afterDark(place.closesAt) }
        : { term: "closes", text: copy.plan.leftOut.closesBefore(place.closesAt!, clock(mine.startMin), durationMin) });
    }
    if (evening != null && evening - mine.reachedMin > EVENING_WAIT_MAX) {
      const prevEnd = at > 0 ? after.items[at - 1].endMin : input.dayStartMin;
      out.push({ term: "evening", text: copy.plan.fit.eveningWait(clock(evening), clock(prevEnd)) });
    }
    if (evening == null && mine.waitMin > OPEN_WAIT_MAX_MIN) {
      out.push({ term: "opens_later", text: copy.plan.leftOut.opensLater(place.opensAt!, mine.waitMin) });
    }
    if (evening == null && mine.endMin > dayEnd) {
      out.push({ term: "past_day_end", text: copy.plan.leftOut.pastDayEnd(clock(dayEnd)) });
    }
    // What it does to the stops already there.
    before.items.forEach((was, i) => {
      const now = after.items[i >= at ? i + 1 : i];
      const q = places.get(was.placeId);
      if (!q) return;
      if (now.pastClosing && !was.pastClosing) out.push({ term: "pushes_closing", text: copy.plan.fit.pushesClosing(q.name, q.closesAt!) });
      if (now.pinShortMin > was.pinShortMin && input.items[i].locked && input.items[i].startMin != null) {
        out.push({ term: "pushes_pin", text: copy.plan.fit.pushesPin(q.name, clock(input.items[i].startMin!)) });
      }
    });
    if (after.overBy > before.overBy) {
      out.push(before.overBy === 0
        ? { term: "over_day", text: copy.plan.fit.overDay(dur(after.overBy), dur(after.budgetMin)) }
        : { term: "over_day", text: copy.plan.fit.moreOver(dur(after.overBy - before.overBy), dur(before.overBy)) });
    }
    const detour = detourKm(at);
    if (detour != null && detour > DETOUR_DROP_KM) {
      const [prev, next] = neighbours(at);
      out.push({ term: "out_of_way", text: copy.plan.fit.outOfWay(prev!.name, next!.name, detour.toFixed(1)) });
    }
    return out;
  }

  function neighbours(at: number): [PlaceInput | undefined, PlaceInput | undefined] {
    return [places.get(input.items[at - 1]?.placeId ?? ""), places.get(input.items[at]?.placeId ?? "")];
  }

  /** Kilometres off the straight line between the stops either side, or
   *  null without both neighbours' positions and its own. */
  function detourKm(at: number): number | null {
    const [prev, next] = neighbours(at);
    if (!prev || !next) return null;
    const a = metresBetween(prev, place);
    const b = metresBetween(place, next);
    const ab = metresBetween(prev, next);
    if (a == null || b == null || ab == null) return null;
    return (a + b - ab) / 1000;
  }

  function score() {
    const categoryCounts = new Map<string, number>();
    for (const it of input.items) {
      const c = places.get(it.placeId)?.category;
      if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
    }
    return scorePlace(place, t, {
      categoryCounts,
      remainingMin: Math.max(0, DAY_BUDGET_MINUTES[t.pace] - before.activeMin),
      date,
      earlyStart: input.dayStartMin <= 8 * 60,
    });
  }

  /** True things only: where it sits, its best time if the day reaches it,
   *  then the score's own positive clauses. */
  function praiseAt(at: number, after: RetimedDay): string[] {
    const out: string[] = [];
    const mine = after.items[at];
    const [prev, next] = neighbours(at);
    const detour = detourKm(at);
    if (detour != null && detour <= RETURN_NEAR_M / 1000) out.push(copy.plan.fit.onTheWay(prev!.name, next!.name));
    else if (prev && mine.arriveBy?.mode === "walk") out.push(copy.plan.fit.walkFrom(mine.arriveBy.minutes, prev.name));

    if (eveningWindow(place) != null || evening != null) {
      if (mine.startMin >= (evening ?? eveningWindow(place)!)) out.push(copy.plan.reasons.evening);
    } else {
      const wins = place.bestWindow.map(parseWindow);
      const early = wins.find((w) => w.before != null && mine.startMin < w.before);
      const late = wins.find((w) => w.after != null && mine.startMin >= w.after);
      if (early && (place.crowdLevel ?? 0) >= 0.7) out.push(copy.plan.reasons.beforeCrowd(clock(mine.startMin)));
      else if (late) out.push(copy.plan.reasons.afterCrowd(clock(late.after!)));
    }

    const clauses = score().terms
      .filter((x) => x.clause && x.contribution > 0)
      .sort((x, y) => y.contribution - x.contribution)
      .map((x) => x.clause!);
    for (const c of clauses) if (out.length < MAX_PRAISE && !out.includes(c)) out.push(c);
    return out.slice(0, MAX_PRAISE);
  }

  /** Legs Bento has no route for: the day's clock guesses them. */
  function notesAt(at: number): string[] {
    const [prev, next] = neighbours(at);
    const out: string[] = [];
    if (prev && !input.travel(prev, place)) out.push(copy.plan.warnings.noRouteAssumed(prev.name, place.name, FALLBACK_TRAVEL_MIN));
    if (next && !input.travel(place, next)) out.push(copy.plan.warnings.noRouteAssumed(place.name, next.name, FALLBACK_TRAVEL_MIN));
    return out;
  }
}
