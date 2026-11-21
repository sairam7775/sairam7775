/** The minutes shown after the line between two stops, or null. A walk's
 *  words ("Walk · 14 min", "About a 14-min walk") and the no-train-data
 *  estimate ("About 45 min — …") already give them; a train journey's
 *  door-to-door words don't, so its total follows. */
export function arriveMinutesSuffix(mode: string | null, minutes: number | null): number | null {
  if (minutes == null) return null;
  return mode === "walk" || mode === "estimate" ? null : minutes;
}
