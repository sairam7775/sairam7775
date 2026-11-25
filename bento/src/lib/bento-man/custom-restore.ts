/** Puts a traveller's own free-text stops (0036) back to their saved times
 *  after `planDay`, and Bento's stops around them (`custom-plan.ts` has the
 *  stand-ins the planner worked with). Pure. */
import type { DayPlan, LockedItem, PlaceInput, PlannedItem, TravelFn, TravelLeg } from "@/lib/engine/types";
import { daylightEndMin } from "@/lib/engine/daylight";
import { parseClock } from "@/lib/engine/filter";
import { uncheckedLeg } from "@/lib/engine/retime";
import { eveningFrom, eveningWindow } from "@/lib/engine/schedule";
import { copy } from "@/copy";
import { isCustomStop } from "./custom-stop";
import type { ItemRow } from "./store";

const DAY_MIN = 24 * 60;
const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** What restoring needs of the plan's own inputs. */
export interface PlannedWith {
  places: PlaceInput[];
  locked: LockedItem[];
  travel: TravelFn;
}

/** Each free-text stop is a fixed interval at its saved time and length,
 *  never moved; no reason of Bento's (it chose nothing); pinned only if the
 *  traveller pinned it. The planner moves a pin the day reaches late, and
 *  puts the later of two overlapping pins first, so afterwards Bento's stops
 *  are placed again, in their order, against all the fixed ones: one that
 *  would sit on top of a fixed stop starts after it, journey included, and
 *  past the next one if it doesn't fit before it. A chosen stop that then
 *  misses its closing, daylight, the day's end or midnight is left out with
 *  the planner's own reason; a pin is kept and what's off is said. Legs,
 *  sums, meals and lateness come from that final day. Without a timed
 *  free-text stop the plan is returned as it was. */
export function restoreCustomStops(plan: DayPlan, items: ItemRow[], { places, locked, travel }: PlannedWith): DayPlan {
  const saved = new Map(items.filter((i) => isCustomStop(i.placeId)).map((i) => [i.placeId, i]));
  const fixedAt = (id: string) => saved.get(id)?.startMin ?? null;
  for (const it of plan.items) {
    const s = saved.get(it.placeId);
    if (!s) continue;
    it.reason = "";
    it.reasonTerms = [];
    it.locked = s.locked;
  }
  if (!plan.items.some((it) => fixedAt(it.placeId) != null)) return plan;

  const placeOf = new Map(places.map((p) => [p.id, p]));
  const pinAt = new Map(locked.map((l) => [l.placeId, l.startMin ?? null]));
  const planned = new Map(plan.items.map((it, k) => [it.placeId, { startMin: it.startMin, leg: it.arriveBy, prev: plan.items[k - 1]?.placeId ?? null }]));

  const legFor = (prev: string | null, id: string): TravelLeg | null => {
    if (prev == null) return null;
    const was = planned.get(id)!;
    if (was.prev === prev) return was.leg;
    if (isCustomStop(prev) || isCustomStop(id)) return uncheckedLeg();
    const a = placeOf.get(prev);
    const b = placeOf.get(id);
    // No route on record: the planner's own flat guess.
    return (a && b ? travel(a, b) : null) ?? uncheckedLeg();
  };
  const legMin = (prev: string, id: string) => legFor(prev, id)?.minutes ?? uncheckedLeg().minutes;
  const closesOf = (id: string): { at: number; dark: boolean } | null => {
    const q = placeOf.get(id);
    if (!q) return null;
    const dark = daylightEndMin(q, plan.date);
    const at = parseClock(q.closesAt);
    if (dark != null && (at == null || dark < at)) return { at: dark, dark: true };
    return at == null ? null : { at, dark: false };
  };
  // In time order; at the same minute a fixed stop first, then as planned.
  const inOrder = (xs: PlannedItem[]) =>
    xs
      .map((it, k) => ({ it, k, f: fixedAt(it.placeId) != null ? 0 : 1 }))
      .sort((a, b) => a.it.startMin - b.it.startMin || a.f - b.f || a.k - b.k)
      .map((x) => x.it);
  const setStart = (it: PlannedItem, at: number) => {
    it.startMin = at;
    it.endMin = at + it.durationMin;
  };

  const fixed = plan.items.filter((it) => fixedAt(it.placeId) != null);
  for (const f of fixed) setStart(f, fixedAt(f.placeId)!);
  const movable = plan.items.filter((it) => fixedAt(it.placeId) == null);
  const moved = new Set<string>();
  // Pins that can't be kept without running past midnight.
  const stuck = new Set<string>();
  // A pin, or the traveller's own stop without a time, is never left out.
  const kept = (it: PlannedItem) => it.locked || isCustomStop(it.placeId);

  /** Places every movable stop; returns a chosen one that no longer fits. */
  function placeAll(): { it: PlannedItem; term: string; detail: string } | null {
    moved.clear();
    stuck.clear();
    const done: PlannedItem[] = [...fixed];
    let last: PlannedItem | null = null;
    for (const it of movable) {
      const was = planned.get(it.placeId)!;
      let at = was.startMin;
      // Each pass clears at least one fixed stop.
      for (let pass = 0; pass <= fixed.length + 1; pass++) {
        if (last) at = Math.max(at, last.endMin);
        const prev = inOrder(done).filter((d) => d.startMin <= at).pop() ?? null;
        // The planner's own timing stands while the stop before is the same
        // Bento stop and was left alone.
        const same = prev != null && prev.placeId === was.prev && !moved.has(prev.placeId) && fixedAt(prev.placeId) == null;
        if (prev && !same) at = Math.max(at, prev.endMin + legMin(prev.placeId, it.placeId));
        const end = at + it.durationMin;
        const clash =
          fixed.find((f) => at < f.endMin && end > f.startMin) ??
          // Moved, it must also leave time to reach the next fixed stop.
          (at !== was.startMin ? fixed.find((f) => at < f.startMin && end + uncheckedLeg().minutes > f.startMin) : undefined);
        if (!clash) break;
        at = Math.max(at, clash.endMin + legMin(clash.placeId, it.placeId));
      }
      const end = at + it.durationMin;
      if (at !== was.startMin) {
        if (kept(it) && end > DAY_MIN) {
          stuck.add(it.placeId);
          setStart(it, was.startMin);
          done.push(it);
          continue;
        }
        if (!kept(it)) {
          const closes = closesOf(it.placeId);
          if (closes && end > closes.at)
            return { it, term: "hours", detail: closes.dark ? copy.plan.leftOut.afterDark(clock(closes.at)) : copy.plan.leftOut.closesBefore(clock(closes.at), clock(at), it.durationMin) };
          const q = placeOf.get(it.placeId);
          // As the planner: an evening place, or one in its evening window, may run later.
          const win = q ? eveningFrom(q) ?? eveningWindow(q) : null;
          if (end > DAY_MIN || (end > plan.dayEndMin && (win == null || at < win)))
            return { it, term: "day_end", detail: copy.plan.leftOut.pastDayEnd(clock(plan.dayEndMin)) };
        }
        moved.add(it.placeId);
      }
      setStart(it, at);
      done.push(it);
      last = it;
    }
    return null;
  }
  for (let out = placeAll(); out; out = placeAll()) {
    const { it, term, detail } = out;
    movable.splice(movable.indexOf(it), 1);
    plan.considered.unshift({ placeId: it.placeId, name: it.name, stage: "validate", term, detail });
    plan.warnings = plan.warnings.filter((w) => !w.startsWith(`${it.name} `));
    plan.placesJpy -= it.costJpy;
    for (const m of movable) setStart(m, planned.get(m.placeId)!.startMin);
  }

  plan.items = inOrder([...fixed, ...movable]);
  plan.items.forEach((it, k) => {
    it.arriveBy = legFor(plan.items[k - 1]?.placeId ?? null, it.placeId);
  });

  // What can't be reached in time, said from the day as it now stands.
  const unsay = (name: string, at: number) => {
    const line = copy.plan.warnings.pinnedLate(name, clock(at), "");
    plan.warnings = plan.warnings.filter((w) => !w.startsWith(line));
  };
  const say = (w: string) => {
    if (!plan.warnings.includes(w)) plan.warnings.push(w);
  };
  plan.items.forEach((it, k) => {
    const prev = plan.items[k - 1];
    const at = fixedAt(it.placeId);
    if (at != null || stuck.has(it.placeId)) {
      if (at != null) unsay(it.name, at);
      const reached = prev ? prev.endMin + (it.arriveBy?.minutes ?? 0) : plan.dayStartMin;
      if (prev && prev.endMin > it.startMin) say(copy.plan.warnings.pinnedShort(it.name, clock(it.startMin), clock(prev.endMin), prev.endMin - it.startMin));
      else if (reached > it.startMin) say(copy.plan.warnings.pinnedLate(it.name, clock(it.startMin), clock(reached)));
      return;
    }
    if (!moved.has(it.placeId)) return;
    const pin = pinAt.get(it.placeId);
    if (pin != null) {
      unsay(it.name, pin);
      if (it.startMin > pin) say(copy.plan.warnings.pinnedLate(it.name, clock(pin), clock(it.startMin)));
    }
    const closes = closesOf(it.placeId);
    if (closes && it.endMin > closes.at)
      say(closes.dark ? copy.plan.warnings.afterDark(it.name, clock(closes.at)) : copy.plan.warnings.closesDuring(it.name, clock(closes.at), clock(it.endMin)));
  });

  // The day's sums, from its final stops and legs.
  plan.activeMin = plan.items.reduce((s, it) => s + it.durationMin + (it.arriveBy?.minutes ?? 0), 0);
  plan.slackMin = Math.max(0, plan.budgetMin - plan.activeMin);
  plan.faresJpy = plan.items.reduce((s, it) => s + (it.arriveBy?.fareJpy ?? 0), 0);
  plan.fareKind = plan.items.some((it) => it.arriveBy?.fareKind === "estimate") ? "estimate" : "exact";
  plan.costJpy = plan.placesJpy + plan.faresJpy;
  plan.startMin = plan.items[0].startMin;
  plan.endMin = Math.max(...plan.items.map((it) => it.endMin));
  // A meal stays only clear of every stop, in a gap with room for the journey too.
  plan.meals = plan.meals.filter((m) => {
    if (plan.items.some((it) => it.startMin < m.endMin && it.endMin > m.startMin)) return false;
    const next = plan.items.find((it) => it.startMin >= m.endMin);
    const prev = plan.items.filter((it) => it.endMin <= m.startMin).pop();
    return !prev || !next || next.startMin - prev.endMin >= m.endMin - m.startMin + (next.arriveBy?.minutes ?? 0);
  });
  return plan;
}
