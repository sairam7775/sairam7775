/** "Plan a Japan trip" has two tabs: the traveller's own answers (the form,
 *  first and the default) and the ready-made trips. `?tab=ready-made` opens
 *  the second; anything else opens the form. */

export const PLAN_TABS = ["own", "ready-made"] as const;
export type PlanTab = (typeof PLAN_TABS)[number];

/** The tab a `tab` search parameter asks for. Only the exact value
 *  "ready-made" opens the ready-made trips; a repeated parameter is read by
 *  its first value. */
export function parsePlanTab(value: string | string[] | undefined): PlanTab {
  const first = Array.isArray(value) ? value[0] : value;
  return first === "ready-made" ? "ready-made" : "own";
}

/** The tabs to show. With no ready-made trip to offer there is only the
 *  form, and the page shows no tabs at all. */
export function planTabs(readyMadeCount: number): PlanTab[] {
  return readyMadeCount > 0 ? [...PLAN_TABS] : ["own"];
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
