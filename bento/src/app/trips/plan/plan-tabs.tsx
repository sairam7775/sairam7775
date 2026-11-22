"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { planTabSearch, shownPlanTab, type PlanTab } from "@/lib/trips/plan-tabs";
import { copy } from "@/copy";

const t = copy.trips.guided.tabs;
const LABELS: Record<PlanTab, string> = { own: t.own, "ready-made": t.readyMade, blank: t.blank };
// Three tabs don't fit a 360px phone in full words, so phones show short
// ones; the tab's name (aria-label) is always the full one.
const SHORT: Record<PlanTab, string> = { own: t.short.own, "ready-made": t.short.readyMade, blank: t.short.blank };

/** The ways to start, as WAI-ARIA tabs. The address is the only record
 *  of the open tab (`?tab=ready-made`, `?tab=blank`): it is read with `useSearchParams`,
 *  so the server renders the right tab and a Back that restores the page
 *  follows the address. Switching replaces the address with
 *  `history.replaceState(null, …)`, which Next syncs into its router, so
 *  nothing reloads and a later navigation keeps it. Both panels stay
 *  mounted and the ones not shown are `hidden`, so each keeps what was typed
 *  in it; a hidden panel's form can't be submitted or validated (each panel
 *  is its own form). */
export function PlanTabs({ tabs, panels }: { tabs: PlanTab[]; panels: Record<PlanTab, ReactNode> }) {
  const selected = shownPlanTab(useSearchParams().get("tab"), tabs);
  const refs = useRef<Partial<Record<PlanTab, HTMLButtonElement | null>>>({});

  const select = (tab: PlanTab) => {
    const { pathname, search, hash } = window.location;
    const next = planTabSearch(search, tab);
    if (next !== search) window.history.replaceState(null, "", `${pathname}${next}${hash}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = tabs.indexOf(selected);
    const to =
      e.key === "ArrowRight" ? tabs[(i + 1) % tabs.length]
      : e.key === "ArrowLeft" ? tabs[(i - 1 + tabs.length) % tabs.length]
      : e.key === "Home" ? tabs[0]
      : e.key === "End" ? tabs[tabs.length - 1]
      : null;
    if (!to) return;
    e.preventDefault();
    select(to);
    refs.current[to]?.focus();
  };

  return (
    <>
      <div role="tablist" aria-label={t.label} className={`mt-6 grid ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"} gap-0.5 rounded-full sm:gap-1 bg-sunk p-1`}>
        {tabs.map((tab) => {
          const on = tab === selected;
          return (
            <button
              key={tab}
              ref={(el) => { refs.current[tab] = el; }}
              type="button"
              role="tab"
              id={`plan-tab-${tab}`}
              aria-selected={on}
              aria-controls={`plan-panel-${tab}`}
              tabIndex={on ? 0 : -1}
              onClick={() => select(tab)}
              onKeyDown={onKeyDown}
              aria-label={LABELS[tab]}
              className={`min-h-10 rounded-full border px-1 leading-tight text-[0.8125rem] font-medium sm:px-2 sm:text-[0.92rem] focus-visible:rounded-full ${on ? "border-accent bg-lacquer text-rice" : "border-transparent text-ink-2 hover:bg-surface hover:text-ink"}`}
            >
              <span aria-hidden className="min-[360px]:whitespace-nowrap sm:hidden">{SHORT[tab]}</span>
              <span aria-hidden className="hidden sm:inline">{LABELS[tab]}</span>
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab} role="tabpanel" id={`plan-panel-${tab}`} aria-labelledby={`plan-tab-${tab}`} tabIndex={0} hidden={tab !== selected}>
          {panels[tab]}
        </div>
      ))}
    </>
  );
}
