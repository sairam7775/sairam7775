/** Does a place the traveller wants fit a day they already have?
 *
 *  "Add a place" on the day box. The traveller chooses the place, so this
 *  makes no choice about WHAT goes in the day; it finds WHERE it fits best
 *  in the traveller's own order and says, from the engine's own rules,
 *  what is true about it there. Nothing new is decided here: the hard rules
 *  are `hardFilter`'s, the clock is `retimeDay`'s, a hike's closing is its
 *  daylight (`daylightEndMin`), the day's end is `dayEndFor`'s, the evening
 *  rule is `eveningFrom`'s, the detour rule is the planner's `straysAt`,
 *  and the praise is `scorePlace`'s clauses and the scheduler's timing
 *  clauses. If it doesn't fit, the traveller may still add it, and the day
 *  shows its usual warnings. Pure: no network, no model. */
import { copy } from "@/copy";
import { hardFilter, parseClock, parseWindow } from "./filter";
import { buildReason, chooseDuration, scorePlace } from "./score";
import { FALLBACK_TRAVEL_MIN, retimeDay, type RetimeItem, type RetimedDay } from "./retime";
import { dayEndFor, eveningFrom, eveningStartOf, eveningWindow, EVENING_WAIT_MAX, OPEN_WAIT_MAX_MIN, RETURN_NEAR_M, straysAt } from "./schedule";
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
  /** A travel day's move, in minutes: it comes out of the day's budget, as
   *  the day box measures it (`dayStats`), and the day ends as any day. */
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
  /** The stop's reason as the planner would store it (`buildReason`), from
   *  the stops before it only. */
  reason: { reason: string; terms: string[] };
  budgetMin: number;
  overByBefore: number;
  overByAfter: number;
  /** The day as re-timed with it at `at`. */
  day: RetimedDay;
}

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const dur = copy.time.duration;
const WEEKDAY_OF = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const MAX_PRAISE = 3;
/** Never a stop this length when the place has no duration on record. */
const FALLBACK_VISIT_MIN = 60;

/** The day's places as the planner times them: a hike closes at its
 *  daylight end on that date, when that is earlier than its own closing.
 *  `dark` holds the ones whose closing is their daylight. */
function daylit(places: Map<string, PlaceInput>, date: string): { places: Map<string, PlaceInput>; dark: Set<string> } {
  const out = new Map<string, PlaceInput>();
  const dark = new Set<string>();
  for (const [id, p] of places) {
    const end = daylightEndMin(p, date);
    const own = parseClock(p.closesAt);
    if (end == null || (own != null && own <= end)) out.set(id, p);
    else {
      out.set(id, { ...p, closesAt: clock(end) });
      dark.add(id);
    }
  }
  return { places: out, dark };
}

/** A daytime stop: one the day's end applies to. An evening place may end
 *  later, and a stop Bento doesn't know may be a dinner: neither counts. */
function daytime(it: RetimeItem, p: PlaceInput | undefined): boolean {
  return !it.unchecked && p != null && eveningFrom(p) == null && eveningWindow(p) == null;
}

/** Minutes a visit runs past its place's closing (a hike's daylight), 0 if none. */
function pastClosingMin(endMin: number, p: PlaceInput | undefined): number {
  const closes = parseClock(p?.closesAt);
  return closes == null ? 0 : Math.max(0, endMin - closes);
}

/** What putting a stop at `at` does to the stops already there: one that
 *  runs further past closing (or into the dark) than before, a pin reached later than before,
 *  a daytime stop now ending after the day's end, more time over budget. */
function effectsOnDay(c: {
  items: RetimeItem[];
  before: RetimedDay;
  after: RetimedDay;
  at: number;
  places: Map<string, PlaceInput>;
  dark: Set<string>;
  dayEnd: number;
}): FitProblem[] {
  const out: FitProblem[] = [];
  c.before.items.forEach((was, i) => {
    const now = c.after.items[i >= c.at ? i + 1 : i];
    const it = c.items[i];
    const q = c.places.get(it.placeId);
    const name = q?.name ?? it.name ?? it.placeId;
    // Further past closing than before, from on time or from already late.
    if (q && pastClosingMin(now.endMin, q) > pastClosingMin(was.endMin, q)) {
      out.push(c.dark.has(q.id)
        ? { term: "pushes_dark", text: copy.plan.warnings.afterDark(q.name, q.closesAt!) }
        : { term: "pushes_closing", text: copy.plan.fit.pushesClosing(q.name, q.closesAt!) });
    }
    // A pin's time is the traveller's, whatever the stop: no place needed.
    if (it.locked && it.startMin != null && now.pinShortMin > was.pinShortMin) {
      out.push({ term: "pushes_pin", text: copy.plan.fit.pushesPin(name, clock(it.startMin)) });
    }
    if (daytime(it, q) && was.endMin <= c.dayEnd && now.endMin > c.dayEnd) {
      out.push({ term: "past_day_end", text: copy.plan.leftOut.pastDayEnd(clock(c.dayEnd)) });
    }
  });
  const over = overDayProblem(c.before, c.after);
  if (over) out.push(over);
  return out;
}

/** The same problem said once. */
function unique(ps: FitProblem[]): FitProblem[] {
  const seen = new Set<string>();
  return ps.filter((p) => (seen.has(p.text) ? false : (seen.add(p.text), true)));
}

export function fitPlace(input: FitInput): PlaceFit {
  const { date, traveller: t } = input;
  const all = new Map(input.places);
  all.set(input.place.id, input.place);
  const { places, dark } = daylit(all, date);
  const place = places.get(input.place.id)!;

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
    if (q && !it.unchecked && (place.conflictsWith.includes(q.id) || q.conflictsWith.includes(place.id))) {
      common.push({ term: "conflicts_with", text: copy.plan.leftOut.clash(q.name) });
    }
  }

  const durationMin = chooseDuration(place, t.pace) ?? FALLBACK_VISIT_MIN;
  const evening = eveningFrom(place);
  const dayEnd = dayEndFor(input.dayStartMin, t.pace, input.moveMin ?? 0);
  const retime = (items: RetimeItem[]) => retimeDay({ items, places, travel: input.travel, pace: t.pace, dayStartMin: input.dayStartMin, moveMin: input.moveMin });
  const before = retime(input.items);
  // The day's shape is measured on the stops Bento knows where to find.
  const known = input.items.map((it) => ({ place: it.unchecked ? undefined : places.get(it.placeId), locked: it.locked }));
  const seq = known.filter((k): k is { place: PlaceInput; locked: boolean } => k.place != null);
  const seqAt = (at: number) => known.slice(0, at).filter((k) => k.place != null).length;

  // Every spot in the traveller's order; an evening place only after the
  // day's other stops, as the planner puts it.
  const spots = input.at != null ? [Math.max(0, Math.min(input.items.length, input.at))]
    : evening != null ? [input.items.length]
    : Array.from({ length: input.items.length + 1 }, (_, i) => i);
  let best: { at: number; item: RetimeItem; after: RetimedDay; problems: FitProblem[]; cost: number } | null = null;
  for (const at of spots) {
    const item = itemFor(at);
    const after = retime([...input.items.slice(0, at), item, ...input.items.slice(at)]);
    const problems = unique([...common, ...spotProblems(at, after), ...effectsOnDay({ items: input.items, before, after, at, places, dark, dayEnd })]);
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
    reason: buildReason(score(at)),
    budgetMin: before.budgetMin,
    overByBefore: before.overBy,
    overByAfter: after.overBy,
    day: after,
  };

  /** The stop to insert. An evening place the day reaches before its
   *  evening is held there, so re-timing never puts it in the afternoon. */
  function itemFor(at: number): RetimeItem {
    const plain: RetimeItem = { placeId: place.id, durationMin, locked: false, startMin: null };
    if (evening == null) return plain;
    const reached = retime([...input.items.slice(0, at), plain, ...input.items.slice(at)]).items[at].reachedMin;
    return reached < evening ? { ...plain, locked: true, startMin: evening } : plain;
  }

  /** The candidate's own problems at `at`. */
  function spotProblems(at: number, after: RetimedDay): FitProblem[] {
    const out: FitProblem[] = [];
    const mine = after.items[at];
    if (mine.pastClosing) {
      out.push(dark.has(place.id)
        ? { term: "after_dark", text: copy.plan.leftOut.afterDark(place.closesAt!) }
        : { term: "closes", text: copy.plan.leftOut.closesBefore(place.closesAt!, clock(mine.startMin), durationMin) });
    }
    if (evening != null && evening - mine.reachedMin > EVENING_WAIT_MAX) {
      const prevEnd = at > 0 ? after.items[at - 1].endMin : input.dayStartMin;
      out.push({ term: "evening", text: copy.plan.fit.eveningWait(clock(evening), clock(prevEnd)) });
    }
    if (evening == null && mine.waitMin > OPEN_WAIT_MAX_MIN) {
      out.push({ term: "opens_later", text: copy.plan.leftOut.opensLater(place.opensAt!, mine.waitMin) });
    }
    if (daytime(mine, place) && mine.endMin > dayEnd) {
      out.push({ term: "past_day_end", text: copy.plan.leftOut.pastDayEnd(clock(dayEnd)) });
    }
    // The planner's way rule at every spot, the day's ends included, and
    // its exemption: an evening stop ends the day wherever it began.
    const k = seqAt(at);
    if (eveningStartOf(place, durationMin) == null && straysAt(seq, place, k)) {
      const detour = detourKm(at);
      out.push(detour != null
        ? { term: "out_of_way", text: copy.plan.fit.outOfWay(seq[k - 1].place.name, seq[k].place.name, detour.toFixed(1)) }
        : { term: "out_of_way", text: copy.plan.leftOut.outOfWay });
    }
    return out;
  }

  function neighbours(at: number): [PlaceInput | undefined, PlaceInput | undefined] {
    const k = seqAt(at);
    // Neighbours in the order, not past a stop Bento doesn't know.
    const prev = at > 0 && known[at - 1].place ? seq[k - 1]?.place : undefined;
    const next = at < known.length && known[at].place ? seq[k]?.place : undefined;
    return [prev, next];
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

  /** The score as the planner gives it, counting only the stops before it,
   *  so "your third temple today" is the third one shown. */
  function score(at: number) {
    const categoryCounts = new Map<string, number>();
    for (const it of input.items.slice(0, at)) {
      const c = it.unchecked ? undefined : places.get(it.placeId)?.category;
      if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1);
    }
    return scorePlace(place, t, {
      categoryCounts,
      remainingMin: Math.max(0, before.budgetMin - before.activeMin),
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

    const clauses = score(at).terms
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
    // Beside a stop Bento doesn't know, the leg is the re-timer's guess.
    if (input.items[at - 1]?.unchecked || input.items[at]?.unchecked) out.push(copy.plan.warnings.uncheckedLeg(FALLBACK_TRAVEL_MIN));
    return out;
  }
}

/** A stop the traveller named that Bento doesn't know (0036). Nothing about
 *  the place can be checked: no hours, no position, no route. It goes at the
 *  end of the day, for the length the traveller gave, and the clock's own
 *  facts still hold: the day's budget (less a travel day's move) and its
 *  end, the stops already there, with the legs to it guessed (`retimeDay`'s
 *  `unchecked`). `checked` is always false, so no caller can present it as
 *  a fit. */
export function fitUnchecked(input: {
  key: string;
  name?: string;
  durationMin: number;
  items: RetimeItem[];
  places: Map<string, PlaceInput>;
  travel: TravelFn;
  pace: TravellerInput["pace"];
  dayStartMin: number;
  moveMin?: number;
  /** The day, for hikes' daylight. Without it, hikes keep their own hours. */
  date?: string;
}): { checked: false; at: number; item: RetimeItem; startMin: number; endMin: number; problems: FitProblem[]; notes: string[] } {
  const item: RetimeItem = { placeId: input.key, name: input.name, durationMin: input.durationMin, locked: false, startMin: null, unchecked: true };
  const at = input.items.length;
  const { places, dark } = input.date ? daylit(input.places, input.date) : { places: input.places, dark: new Set<string>() };
  const retime = (items: RetimeItem[]) => retimeDay({ items, places, travel: input.travel, pace: input.pace, dayStartMin: input.dayStartMin, moveMin: input.moveMin });
  const before = retime(input.items);
  const after = retime([...input.items, item]);
  const mine = after.items[at];
  const dayEnd = dayEndFor(input.dayStartMin, input.pace, input.moveMin ?? 0);
  return {
    checked: false,
    at,
    item,
    startMin: mine.startMin,
    endMin: mine.endMin,
    problems: unique(effectsOnDay({ items: input.items, before, after, at, places, dark, dayEnd })),
    notes: at > 0 ? [copy.plan.warnings.uncheckedLeg(FALLBACK_TRAVEL_MIN)] : [],
  };
}

/** More time over the day's budget than before, said once the same way. */
function overDayProblem(before: RetimedDay, after: RetimedDay): FitProblem | null {
  if (after.overBy <= before.overBy) return null;
  return before.overBy === 0
    ? { term: "over_day", text: copy.plan.fit.overDay(dur(after.overBy), dur(after.budgetMin)) }
    : { term: "over_day", text: copy.plan.fit.moreOver(dur(after.overBy - before.overBy), dur(before.overBy)) };
}

/** What is off about a day as it is saved, stop by stop, by the same rules
 *  and in the same words: closed that day, a ticket needed and not held,
 *  an exclude or a hard mobility need, a stop it can't share a day with,
 *  a visit past closing (a hike past its daylight), an evening place before
 *  its evening, a daytime stop ending after the day's end (`dayEndFor`,
 *  from the day's first stored start and a travel day's move). A pin made
 *  late can't be told from what is stored: re-timing saves the time the day
 *  reaches it. Worked out again on every render, never stored, so a stop
 *  added anyway keeps saying what's off after the sheet closes, and stops
 *  saying it once it isn't (a ticket booked, the stop moved). A stop Bento
 *  doesn't know has nothing to check. */
export function savedDayProblems(input: {
  date: string;
  items: { placeId: string; startMin: number | null; durationMin: number | null; unchecked?: boolean }[];
  places: Map<string, PlaceInput>;
  traveller: TravellerInput;
  bookedPlaceIds?: Iterable<string>;
  /** A travel day's move, in minutes. */
  moveMin?: number;
}): string[][] {
  const { places, dark } = daylit(input.places, input.date);
  // The start an edit keeps (the first stored start), as day-actions does.
  const starts = input.items.map((i) => i.startMin).filter((m): m is number => m != null);
  const dayEnd = starts.length ? dayEndFor(Math.min(...starts), input.traveller.pace, input.moveMin ?? 0) : null;
  const booked = new Set(input.bookedPlaceIds ?? []);
  const placeOf = (it: { placeId: string; unchecked?: boolean }) => (it.unchecked ? undefined : places.get(it.placeId));
  return input.items.map((it, i) => {
    const p = placeOf(it);
    if (!p) return [];
    const out: string[] = [];
    const rejected = hardFilter(p, input.traveller, { date: input.date, weekday: WEEKDAY_OF(input.date), bookedPlaceIds: booked, usedPlaceIds: new Set() });
    if (rejected) out.push(rejected.detail);
    input.items.forEach((other, j) => {
      const q = j === i ? undefined : placeOf(other);
      if (q && (p.conflictsWith.includes(q.id) || q.conflictsWith.includes(p.id))) out.push(copy.plan.leftOut.clash(q.name));
    });
    if (it.startMin != null && it.durationMin != null) {
      const end = it.startMin + it.durationMin;
      const closes = parseClock(p.closesAt);
      if (closes != null && end > closes) {
        out.push(dark.has(p.id) ? copy.plan.warnings.afterDark(p.name, p.closesAt!) : copy.plan.warnings.closesDuring(p.name, p.closesAt!, clock(end)));
      }
      const evening = eveningFrom(p);
      if (evening != null && it.startMin < evening) out.push(copy.plan.fit.beforeEvening(clock(evening)));
      if (dayEnd != null && daytime({ placeId: it.placeId, durationMin: it.durationMin, locked: false, startMin: null }, p) && end > dayEnd) {
        out.push(copy.plan.leftOut.pastDayEnd(clock(dayEnd)));
      }
    }
    return out;
  });
}
