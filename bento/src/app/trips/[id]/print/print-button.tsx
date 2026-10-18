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
        track("plan_downloaded", { days, bookings });
        window.print();
      }}
      className="min-h-10 rounded-full bg-accent px-5 text-[0.9rem] font-medium text-white hover:bg-accent-deep"
    >
      {copy.print.save}
    </button>
  );
}
