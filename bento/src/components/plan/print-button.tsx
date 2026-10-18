"use client";

import { track } from "@/lib/analytics/client";
import { copy } from "@/copy";

/** Opens the browser's print window, where "Save as PDF" keeps the plan as
 *  a file. A real PDF from the browser keeps the fonts, Japanese included,
 *  and needs no server work. */
export function PrintButton({ days, bookings }: { days: number; bookings: number }) {
  return (
    <button
      type="button"
      onClick={() => {
        // The print window opened; whether a PDF was saved can't be known.
        track("plan_print_opened", { days, bookings });
        window.print();
      }}
      className="min-h-10 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-on-accent hover:bg-accent-deep"
    >
      {copy.print.save}
    </button>
  );
}
