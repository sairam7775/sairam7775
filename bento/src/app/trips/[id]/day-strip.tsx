"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { centeredDayScrollLeft } from "./day-strip-scroll";

export function DayStrip({ label, selected, children }: { label: string; selected: string | null; children: ReactNode }) {
  const strip = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = strip.current;
    const chip = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !chip || !selected) return;

    const stripRect = el.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    const left = centeredDayScrollLeft({
      stripLeft: stripRect.left,
      stripScrollLeft: el.scrollLeft,
      stripClientWidth: el.clientWidth,
      stripScrollWidth: el.scrollWidth,
      chipLeft: chipRect.left,
      chipWidth: chipRect.width,
    });
    // Assign only the strip's horizontal offset: scrolling a chip into view also moves the page.
    el.scrollLeft = left;
  }, [selected]);

  return (
    <nav
      ref={strip}
      aria-label={label}
      className="up sticky top-0 z-20 -mx-4 mt-5 overflow-x-auto bg-paper px-4 pt-[env(safe-area-inset-top)] pb-2 sm:mx-0 sm:px-0 lg:static lg:z-auto lg:bg-transparent lg:pt-0 lg:pb-0"
      style={{ animationDelay: ".1s" }}
    >
      {children}
    </nav>
  );
}
