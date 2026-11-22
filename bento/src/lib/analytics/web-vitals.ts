/** Real visitors' page speed, as the three numbers Bento has budgets for
 *  (docs/bento/40-non-functional/performance.md): Largest Contentful Paint,
 *  Interaction to Next Paint and Cumulative Layout Shift. Only the metric's
 *  name, its value and the browser's rating leave: never its element, its
 *  entries or its address (the page address goes the way every event's
 *  does, path only). Sent through `track`, so only with analytics consent. */

export const BUDGETED_VITALS = ["LCP", "INP", "CLS"] as const;
type Vital = (typeof BUDGETED_VITALS)[number];

const RATINGS = ["good", "needs-improvement", "poor"] as const;
type Rating = (typeof RATINGS)[number];

export function webVitalProps(metric: { name: string; value: number; rating?: string }): { metric: Vital; value: number; rating: Rating | null } | null {
  const name = BUDGETED_VITALS.find((v) => v === metric.name);
  if (!name || !Number.isFinite(metric.value)) return null;
  // CLS is a unitless score; the other two are milliseconds.
  const value = name === "CLS" ? Math.round(metric.value * 1000) / 1000 : Math.round(metric.value);
  const rating = RATINGS.find((r) => r === metric.rating) ?? null;
  return { metric: name, value, rating };
}
