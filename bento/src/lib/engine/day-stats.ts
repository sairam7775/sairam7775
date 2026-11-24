/** What a stored day adds up to, for the view. Pure: reads the persisted
 *  starts, durations and legs and says how full the box is. The numbers
 *  come from the scheduler or the re-timer; this only sums them. */
import { DAY_BUDGET_MINUTES, type TravelPace } from "@/lib/types";

export interface StatItem {
  startMin: number | null;
  durationMin: number | null;
  arriveMinutes: number | null;
}

export interface DayStats {
  budgetMin: number;
  /** Time at places plus time moving. */
  activeMin: number;
  overBy: number;
  /** The first gap of 45 minutes or more between 11:30 and 14:00. */
  lunch: { startMin: number; endMin: number } | null;
  /** Every gap of over two hours between two stops, less lunch and the leg
   *  to the next stop: free time, before the stop at `beforeIndex`. */
  freeTime: { startMin: number; endMin: number; beforeIndex: number }[];
  /** Where, in the sequence, the budget runs out (index of the first stop past it), or null. */
  overFromIndex: number | null;
}

const LUNCH_EARLIEST = 11 * 60 + 30;
const LUNCH_LATEST = 14 * 60;
/** As the planner's own note (`FREE_TIME_NOTE_MIN`, schedule.ts). */
const FREE_TIME_MIN = 120;

/** `moveMin`: on a travel day, the move (`travelDayMoves`), which the
 *  planner took out of the day's time; the box measures against the same. */
/** How full a day is, 0–100, for a bar or ring. A day with no time left
 *  (a move longer than the day) reads as full once anything is in it. */
export function fillPercent(activeMin: number, budgetMin: number): number {
  if (budgetMin <= 0) return activeMin > 0 ? 100 : 0;
  return Math.min(100, Math.round((activeMin / budgetMin) * 100));
}

export function dayStats(items: StatItem[], pace: TravelPace, moveMin = 0): DayStats {
  const budgetMin = Math.max(0, DAY_BUDGET_MINUTES[pace] - moveMin);
  let activeMin = 0;
  let overFromIndex: number | null = null;
  items.forEach((it, i) => {
    activeMin += (it.durationMin ?? 0) + (i > 0 ? it.arriveMinutes ?? 0 : 0);
    if (overFromIndex == null && activeMin > budgetMin) overFromIndex = i;
  });

  let lunch: DayStats["lunch"] = null;
  for (let i = 0; i + 1 < items.length; i++) {
    const a = items[i];
    const b = items[i + 1];
    if (a.startMin == null || a.durationMin == null || b.startMin == null) continue;
    const gapStart = a.startMin + a.durationMin;
    const gapEnd = b.startMin - (b.arriveMinutes ?? 0);
    const from = Math.max(gapStart, LUNCH_EARLIEST);
    if (gapEnd - from >= 45 && from <= LUNCH_LATEST) {
      lunch = { startMin: from, endMin: Math.min(gapEnd, from + 60) };
      break;
    }
  }

  // Free time: what is left of a gap between two stops, after lunch, before
  // the leg to the next one. The planner warns of the same wait before a
  // pinned evening stop, but a day saved at once (a ready-made trip) never
  // shows its warnings, so the box says it from the stored times.
  const freeTime: DayStats["freeTime"] = [];
  for (let i = 0; i + 1 < items.length; i++) {
    const a = items[i];
    const b = items[i + 1];
    if (a.startMin == null || a.durationMin == null || b.startMin == null) continue;
    let from = a.startMin + a.durationMin;
    const to = b.startMin - (b.arriveMinutes ?? 0);
    if (lunch && lunch.startMin >= from && lunch.endMin <= to) from = lunch.endMin;
    if (to - from > FREE_TIME_MIN) freeTime.push({ startMin: from, endMin: to, beforeIndex: i + 1 });
  }

  return { budgetMin, activeMin, overBy: Math.max(0, activeMin - budgetMin), lunch, freeTime, overFromIndex };
}
