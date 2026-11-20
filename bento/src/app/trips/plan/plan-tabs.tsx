"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { planTabSearch, type PlanTab } from "@/lib/trips/plan-tabs";
import { copy } from "@/copy";

const t = copy.trips.guided.tabs;
const LABELS: Record<PlanTab, string> = { own: t.own, "ready-made": t.readyMade };

/** The two ways to start, as WAI-ARIA tabs. Both panels stay mounted and the
 *  one not shown is `hidden`, so each keeps what was typed in it; a hidden
 *  panel's form can't be submitted or validated (each panel is its own
 *  form). Switching replaces the address (`?tab=ready-made`) without a
 *  reload, so a refresh or a shared link opens the same tab. */
export function PlanTabs({ tabs, initial, panels }: { tabs: PlanTab[]; initial: PlanTab; panels: Record<PlanTab, ReactNode> }) {
  const [selected, setSelected] = useState<PlanTab>(initial);
  const refs = useRef<Partial<Record<PlanTab, HTMLButtonElement | null>>>({});

  const select = (tab: PlanTab) => {
    setSelected(tab);
    const { pathname, search, hash } = window.location;
    const next = planTabSearch(search, tab);
    if (next !== search) window.history.replaceState(window.history.state, "", `${pathname}${next}${hash}`);
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
      <div role="tablist" aria-label={t.label} className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-sunk p-1">
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
              className={`min-h-10 rounded-full px-2 leading-tight text-[0.875rem] font-medium sm:text-[0.92rem] focus-visible:rounded-full ${on ? "bg-lacquer text-rice" : "text-ink-2 hover:bg-surface hover:text-ink"}`}
            >
              {LABELS[tab]}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div key={tab} role="tabpanel" id={`plan-panel-${tab}`} aria-labelledby={`plan-tab-${tab}`} hidden={tab !== selected}>
          {panels[tab]}
        </div>
      ))}
    </>
  );
}
