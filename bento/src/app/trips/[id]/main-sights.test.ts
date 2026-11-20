/** Q12: a day planned in a city Bento knows by its main sights says so,
 *  in one calm line, on the proposal card, the saved day and the sheet
 *  (download, and the shared link for days in a route city: Q16, pinned
 *  in shared-plan.test.ts), so the views agree. A well-covered
 *  day shows nothing extra. Rendered to static HTML, as the admin review
 *  tests do. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";
import type { DayDiff, Proposal } from "@/lib/bento-man/diff";
import { planDocument } from "@/lib/trips/plan-document";
import { PlanSheet } from "@/components/plan/plan-sheet";

// Server actions: never run here, only referenced by the forms.
vi.mock("./actions", () => ({ acceptProposal: vi.fn(), rejectProposal: vi.fn() }));
vi.mock("./day-actions", () => ({ moveItem: vi.fn(), removeItem: vi.fn(), reorderDay: vi.fn(), replanDayAction: vi.fn(), togglePin: vi.fn() }));
vi.mock("./booking-actions", () => ({ planBooking: vi.fn(), unplanBooking: vi.fn() }));

const { ProposalCard } = await import("./proposal-card");
const { DayBox } = await import("./day-box");

const LINE = copy.mainSightsDay;

const day = (date: string, cityId: string): DayDiff => ({
  date,
  cityId,
  summary: "1 stop added",
  after: [{ placeId: `${cityId}-a`, name: "A shrine", startMin: 540, endMin: 600, change: "added", locked: false, reason: "quiet early", reasonTerms: [], arriveDetail: null, arriveMode: null, arriveMinutes: null, durationMin: 60, costJpy: 0, nameJa: null }],
  removed: [],
  considered: [],
  warnings: [],
  activeMin: 60,
  budgetMin: 480,
  costJpy: 0,
  fareKind: "exact",
} as unknown as DayDiff);

const card = (proposal: Proposal, cityTiers: Record<string, string>) =>
  renderToStaticMarkup(createElement(ProposalCard, { tripId: "t1", messageId: "m1", proposal, status: "proposed", cityNames: { miyajima: "Miyajima", "kyoto-city": "Kyoto" }, cityTiers }));

describe("the proposal card", () => {
  it("labels a day in a main-sights city and not a well-covered one", () => {
    const html = card({ summary: "2 days", days: [day("2026-11-24", "kyoto-city"), day("2026-11-28", "miyajima")] }, { miyajima: "outline", "kyoto-city": "deep" });
    expect(html.split(LINE)).toHaveLength(2);
    // The line sits in Miyajima's day, after Kyoto's.
    expect(html.indexOf(LINE)).toBeGreaterThan(html.indexOf("Miyajima"));
  });

  it("takes the coverage from a route proposed with the days", () => {
    const proposal: Proposal = {
      summary: "route and a day",
      route: { kind: "route", before: [], after: [{ cityId: "miyajima", name: "Miyajima", nights: 1, reason: null, budgetBand: null, arriveDate: "2026-11-28", departDate: "2026-11-29", tier: "outline" }], summary: "Miyajima", verdict: "fine", arithmetic: "1 city" },
      days: [day("2026-11-28", "miyajima")],
    };
    expect(card(proposal, {})).toContain(LINE);
  });

  // A stored route remembers the coverage it was proposed with; the city
  // may have been promoted or demoted since. The current reading wins.
  const routed = (tier: "deep" | "outline"): Proposal => ({
    summary: "route and a day",
    route: { kind: "route", before: [], after: [{ cityId: "miyajima", name: "Miyajima", nights: 1, reason: null, budgetBand: null, arriveDate: "2026-11-28", departDate: "2026-11-29", tier }], summary: "Miyajima", verdict: "fine", arithmetic: "1 city" },
    days: [day("2026-11-28", "miyajima")],
  });
  it("prefers the city's current coverage over the one stored with the route", () => {
    expect(card(routed("outline"), { miyajima: "deep" })).not.toContain(LINE);
    expect(card(routed("deep"), { miyajima: "outline" })).toContain(LINE);
  });

  it("shows nothing extra for a well-covered day", () => {
    expect(card({ summary: "1 day", days: [day("2026-11-24", "kyoto-city")] }, { "kyoto-city": "deep" })).not.toContain(LINE);
  });
});

const box = (mainSights: boolean, withStops = true) =>
  renderToStaticMarkup(createElement(DayBox, {
    tripId: "t1", date: "2026-11-28", cityId: "miyajima", cityName: "Miyajima", tier: copy.coverage.outline,
    items: withStops ? [{ placeId: "mym-itsukushima", name: "Itsukushima Shrine", startMin: 540, durationMin: 60, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null }] : [],
    budgetMin: 480, fillPct: 13, activeMin: 60, overBy: 0, overFromIndex: null, lunch: null, editable: true, mainSights, bookings: [], tripDays: ["2026-11-28"],
  }));

describe("the day box", () => {
  it("labels a saved day in a main-sights city, and keeps Re-plan", () => {
    const html = box(true);
    expect(html).toContain(LINE);
    expect(html).toContain(copy.day.replan);
  });
  it("shows nothing extra for a well-covered day, or a day with no stops yet", () => {
    expect(box(false)).not.toContain(LINE);
    expect(box(true, false)).not.toContain(LINE);
  });
});

describe("the plan sheet (download and shared link)", () => {
  const item = (placeId: string) => ({ placeId, name: placeId, sortOrder: 0, startMin: 540, durationMin: 60, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null });
  const state = {
    prefs: { pace: "standard" as const },
    cities: [],
    days: [
      { date: "2026-11-27", cityId: "hiroshima-city", items: [item("hir-peace-park")] },
      { date: "2026-11-28", cityId: "miyajima", items: [item("mym-itsukushima")] },
      { date: "2026-11-29", cityId: "miyajima", items: [] },
    ],
  };
  const dayList: [string, { cityName: string; tier: string }][] = [
    ["2026-11-27", { cityName: "Hiroshima", tier: "deep" }],
    ["2026-11-28", { cityName: "Miyajima", tier: "outline" }],
    ["2026-11-29", { cityName: "Miyajima", tier: "outline" }],
  ];
  const doc = planDocument(state, dayList, [], new Map(), new Map());

  it("marks only planned days in a main-sights city", () => {
    expect(doc.days.map((d) => d.mainSights)).toEqual([false, true, false]);
  });

  it("prints the line under that day", () => {
    const html = renderToStaticMarkup(createElement(PlanSheet, { trip: { id: "t1", title: "Trip", startDate: "2026-11-27", endDate: "2026-11-29", partySize: 1, status: "planning" }, doc, today: "2026-11-14", link: { label: "Link", url: "https://example.test/t1" } }));
    expect(html.split(LINE)).toHaveLength(2);
    expect(html.indexOf(LINE)).toBeGreaterThan(html.indexOf("Miyajima"));
  });
});
