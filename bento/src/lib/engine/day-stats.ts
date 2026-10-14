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
  /** Where, in the sequence, the budget runs out (index of the first stop past it), or null. */
  overFromIndex: number | null;
}

const LUNCH_EARLIEST = 11 * 60 + 30;
const LUNCH_LATEST = 14 * 60;

export function dayStats(items: StatItem[], pace: TravelPace): DayStats {
  const budgetMin = DAY_BUDGET_MINUTES[pace];
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

  return { budgetMin, activeMin, overBy: Math.max(0, activeMin - budgetMin), lunch, overFromIndex };
}
