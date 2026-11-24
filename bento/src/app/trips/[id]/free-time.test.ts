/** A long wait in a saved day is said in the box, not left blank
 *  (kansai-hiroshima-7 day 1, read 23 Nov 2026: nothing between Namba
 *  Yasaka Shrine at 14:29 and Dotonbori at 17:30). Rendered to static HTML,
 *  as main-sights.test.ts does. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";
import { dayStats } from "@/lib/engine/day-stats";

vi.mock("./day-actions", () => ({ moveItem: vi.fn(), removeItem: vi.fn(), reorderDay: vi.fn(), replanDayAction: vi.fn(), togglePin: vi.fn() }));
vi.mock("./booking-actions", () => ({ planBooking: vi.fn(), unplanBooking: vi.fn() }));

const { DayBox } = await import("./day-box");

const stop = (placeId: string, name: string, startMin: number, durationMin: number, arriveMinutes: number | null) =>
  ({ placeId, name, startMin, durationMin, locked: false, reason: null, reasonTerms: [], arriveMode: arriveMinutes ? "walk" : null, arriveMinutes, arriveDetail: arriveMinutes ? `Walk to ${name}` : null });

const box = (items: ReturnType<typeof stop>[]) => {
  const stats = dayStats(items, "standard");
  return renderToStaticMarkup(createElement(DayBox, {
    tripId: "t1", date: "2026-12-12", cityId: "osaka-city", cityName: "Osaka", tier: copy.coverage.deep,
    items, budgetMin: stats.budgetMin, fillPct: 50, activeMin: stats.activeMin, overBy: 0, overFromIndex: null,
    lunch: stats.lunch, freeTime: stats.freeTime, editable: true, bookings: [], tripDays: ["2026-12-12"],
  }));
};

describe("free time in the day box", () => {
  it("says a wait of over two hours, before the stop it waits for", () => {
    const html = box([stop("osk-namba-yasaka", "Namba Yasaka Shrine", 849, 20, null), stop("osk-dotonbori", "Dotonbori", 1050, 75, 10)]);
    const note = copy.day.freeTimeNote("Dotonbori", "17:30");
    expect(html).toContain(copy.day.freeTime);
    expect(html).toContain(note);
    expect(html).toContain(copy.time.duration(1040 - 869));
    expect(html.indexOf(note)).toBeGreaterThan(html.indexOf("Namba Yasaka Shrine"));
    expect(html.indexOf(note)).toBeLessThan(html.lastIndexOf("Dotonbori"));
    // Free time ends when the leg to Dotonbori starts, so the leg comes after it.
    expect(html.indexOf(note)).toBeLessThan(html.indexOf("Walk to Dotonbori"));
  });

  it("says nothing for a day without one", () => {
    expect(box([stop("a", "A", 540, 60, null), stop("b", "B", 610, 60, 10)])).not.toContain(copy.day.freeTime);
  });
});
