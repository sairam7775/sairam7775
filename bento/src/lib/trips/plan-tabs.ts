/** "Plan a Japan trip" has three tabs: the traveller's own answers (the
 *  form, first and the default), the ready-made trips and a blank trip (a
 *  name and dates, nothing else). `?tab=ready-made` and `?tab=blank` open
 *  the other two; anything else opens the form. */

export const PLAN_TABS = ["own", "ready-made", "blank"] as const;
export type PlanTab = (typeof PLAN_TABS)[number];

/** The tab a `tab` search parameter asks for. Only the exact values
 *  "ready-made" and "blank" open those tabs; a repeated parameter is read
 *  by its first value. */
export function parsePlanTab(value: string | string[] | undefined): PlanTab {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "ready-made" || first === "blank" ? first : "own";
}

/** The tabs to show. With no ready-made trip to offer, the form and the
 *  blank trip. */
export function planTabs(readyMadeCount: number): PlanTab[] {
  return readyMadeCount > 0 ? [...PLAN_TABS] : ["own", "blank"];
}

/** The open tab: the one the address asks for, if it is shown. */
export function shownPlanTab(value: string | string[] | null | undefined, tabs: PlanTab[]): PlanTab {
  const asked = parsePlanTab(value ?? undefined);
  return tabs.includes(asked) ? asked : "own";
}

/** The search part of the page's address with `tab` open, keeping any other
 *  parameter (a `?season=` preview). The form, the default, has no `tab`. */
export function planTabSearch(current: string, tab: PlanTab): string {
  const params = new URLSearchParams(current);
  if (tab === "own") params.delete("tab");
  else params.set("tab", tab);
  const search = params.toString();
  return search ? `?${search}` : "";
}
