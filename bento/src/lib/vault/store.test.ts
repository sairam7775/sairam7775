import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TripState } from "@/lib/bento-man/store";
import { DEFAULT_PREFS } from "@/lib/bento-man/store";
import { detectGaps } from "./gaps";
import { bookingRowOf, bookingRowOfVault, gapCityOf, gapSourceOf, gapsFrom } from "./store";

/** Only the query surface gapsFrom uses; records every table it reads. */
function fakeDb(places: object[]) {
  const from = vi.fn((table: string) => {
    const q = Object.assign(Promise.resolve({ data: table === "places_public" ? places : null, error: null }), {
      select: () => q, eq: () => q, in: () => q, order: () => q,
    });
    return q;
  });
  return { db: { from } as unknown as SupabaseClient, tables: () => from.mock.calls.map(([t]) => t) };
}

const state: TripState = {
  trip: { id: "trip", title: null, startDate: "2026-12-01", endDate: "2026-12-04", partySize: 1, status: "planning" },
  prefs: { ...DEFAULT_PREFS },
  cities: [
    { cityId: "kyoto-city", name: "Kyoto", tier: "deep", nights: 2, sortOrder: 0, budgetBand: null, reason: null, arriveDate: "2026-12-01", departDate: "2026-12-03" },
    { cityId: "osaka", name: "Osaka", tier: "deep", nights: 1, sortOrder: 1, budgetBand: null, reason: null, arriveDate: "2026-12-03", departDate: "2026-12-04" },
  ],
  days: [
    { date: "2026-12-02", cityId: "kyoto-city", items: [
      { placeId: "kyt-katsura", name: "Katsura", sortOrder: 0, startMin: 600, durationMin: 60, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
      { placeId: "kyt-gion", name: "Gion", sortOrder: 1, startMin: 720, durationMin: 60, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
    ] },
  ],
  pendingProposal: null,
};

const bookingDb = [
  { id: "b1", type: "accommodation" as const, title: "Kyoto inn", starts_at: "2026-12-01T15:00:00", ends_at: "2026-12-03T10:00:00", city_id: "kyoto-city", to_city_id: null, place_id: null },
];

const placesDb = [
  { id: "kyt-katsura", name: "Katsura Imperial Villa", booking_req: "required", booking_lead_days: 90 },
  { id: "kyt-gion", name: "Gion", booking_req: "none", booking_lead_days: null },
];

describe("gapsFrom", () => {
  it("reads only the planned places' booking needs when the page already has the trip", async () => {
    const { db, tables } = fakeDb(placesDb);
    const report = await gapsFrom(db, gapSourceOf(state, bookingDb.map(bookingRowOf), ["flight:none"]), "2026-11-22");
    // The trip, its route, its days and its bookings were read once already,
    // by the page: nothing here reads them again.
    expect(tables()).toEqual(["places_public"]);
    expect(report).toEqual(detectGaps({
      startDate: "2026-12-01",
      endDate: "2026-12-04",
      cities: state.cities.map((c) => ({ cityId: c.cityId, name: c.name, nights: c.nights, sortOrder: c.sortOrder, arriveDate: c.arriveDate, departDate: c.departDate })),
      bookings: [{ id: "b1", type: "accommodation", title: "Kyoto inn", startsOn: "2026-12-01", endsOn: "2026-12-03", cityId: "kyoto-city", toCityId: null, placeId: null }],
      places: [
        { placeId: "kyt-katsura", name: "Katsura Imperial Villa", date: "2026-12-02", bookingReq: "required", bookingLeadDays: 90 },
        { placeId: "kyt-gion", name: "Gion", date: "2026-12-02", bookingReq: "none", bookingLeadDays: null },
      ],
      today: "2026-11-22",
      dismissed: new Set(["flight:none"]),
    }));
    expect(report.gaps.map((g) => g.key)).toEqual(["ticket:kyt-katsura:2026-12-02", "bed:2026-12-03:1", "move:kyoto-city:osaka"]);
    expect(report.dismissed.map((g) => g.key)).toEqual(["flight:none"]);
  });

  it("takes the vault page's own rows as the full read did", () => {
    const row = { city_id: "kyoto-city", nights: 2, sort_order: 0, arrive_date: "2026-12-01", depart_date: "2026-12-03" };
    expect(gapCityOf({ ...row, cities: { name: "Kyoto" } })).toEqual({ cityId: "kyoto-city", name: "Kyoto", nights: 2, sortOrder: 0, arriveDate: "2026-12-01", departDate: "2026-12-03" });
    expect(gapCityOf({ ...row, cities: [{ name: "Kyoto" }] }).name).toBe("Kyoto");
    expect(gapCityOf({ ...row, cities: null }).name).toBe("kyoto-city");
    expect(bookingRowOfVault({
      id: "b1", type: "accommodation", title: "Kyoto inn", provider: null, referenceMasked: null, referenceError: null,
      startsAt: "2026-12-01T15:00:00+00:00", endsAt: null, startTimeKnown: true, endTimeKnown: false,
      cityId: "kyoto-city", toCityId: null, placeId: null, costJpy: null, costAmount: null, costCurrency: null, filePath: null, notes: null,
    })).toEqual({ id: "b1", type: "accommodation", title: "Kyoto inn", startsOn: "2026-12-01", endsOn: null, cityId: "kyoto-city", toCityId: null, placeId: null });
  });

  it("reads nothing at all when no day has a stop", async () => {
    const { db, tables } = fakeDb(placesDb);
    const report = await gapsFrom(db, gapSourceOf({ ...state, days: [] }, [], []), "2026-11-22");
    expect(tables()).toEqual([]);
    expect(report.totalNights).toBe(3);
  });
});
