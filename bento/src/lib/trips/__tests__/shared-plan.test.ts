import { describe, expect, it } from "vitest";
import { buildTripView } from "@/lib/bento-man/trip-view";
import { DEFAULT_PREFS } from "@/lib/bento-man/store";
import { planDocument } from "../plan-document";
import { sharedPlanFromJson } from "../shared-plan";

// What shared_trip() (0020) returns for a two-night Kyoto trip.
const json = {
  trip: { id: "t1", title: "Kyoto autumn", start_date: "2026-11-20", end_date: "2026-11-22", party_size: 2, status: "planning" },
  pace: "relaxed",
  cities: [{ city_id: "kyoto-city", name: "Kyoto", tier: "deep", nights: 2, sort_order: 0, arrive_date: "2026-11-20", depart_date: "2026-11-22" }],
  days: [
    {
      id: "d1", date: "2026-11-21", city_id: "kyoto-city",
      items: [
        { id: "i2", place_id: "kyt-kodaiji", sort_order: 1, start_time: "10:00:00", duration_min: 60, reason: null, arrive_mode: "walk", arrive_minutes: 12, arrive_detail: "Walk" },
        { id: "i1", place_id: "kyt-kiyomizu", sort_order: 0, start_time: "07:00:00", duration_min: 120, reason: "quiet at opening", arrive_mode: null, arrive_minutes: null, arrive_detail: null },
      ],
    },
  ],
  places: [
    { id: "kyt-kiyomizu", name: "Kiyomizu-dera", nearest_station: "kiyomizu-gojo", station_walk_min: 15, opens_at: "06:00:00", closes_at: "18:00:00", crowd_note: "Quiet before 08:00", local_tip: null },
    { id: "kyt-kodaiji", name: "Kodai-ji", nearest_station: null, station_walk_min: null, opens_at: null, closes_at: null, crowd_note: null, local_tip: null },
  ],
  stations: [{ id: "kiyomizu-gojo", name: "Kiyomizu-Gojo" }],
  bookings: [
    { id: "b1", type: "activity", title: "Tea ceremony", starts_at: "2026-11-21T08:30:00+00:00", ends_at: "2026-11-21T09:30:00+00:00", starts_time_known: true, ends_time_known: true, planned_on: "2026-11-21" },
    { id: "b2", type: "accommodation", title: "Hotel Kanra", starts_at: "2026-11-20T00:00:00+00:00", ends_at: null, starts_time_known: false, ends_time_known: null, planned_on: null },
  ],
};

describe("sharedPlanFromJson", () => {
  it("reads what shared_trip returns into the download's inputs", () => {
    const plan = sharedPlanFromJson(json)!;
    expect(plan.state.trip).toEqual({ id: "t1", title: "Kyoto autumn", startDate: "2026-11-20", endDate: "2026-11-22", partySize: 2, status: "planning" });
    expect(plan.state.days[0].items.map((i) => [i.name, i.startMin])).toEqual([["Kodai-ji", 600], ["Kiyomizu-dera", 420]]);
    expect(plan.places.get("kyt-kiyomizu")).toMatchObject({ name: "Kiyomizu-dera", opensAt: "06:00", closesAt: "18:00", nearestStation: "kiyomizu-gojo", crowdNote: "Quiet before 08:00" });
    expect(plan.bookings[1]).toMatchObject({ title: "Hotel Kanra", startTimeKnown: false, endTimeKnown: true });
  });

  it("takes the traveller's pace and nothing else of their preferences", () => {
    expect(sharedPlanFromJson(json)!.state.prefs).toEqual({ ...DEFAULT_PREFS, pace: "relaxed" });
    expect(sharedPlanFromJson({ ...json, pace: null })!.state.prefs.pace).toBe(DEFAULT_PREFS.pace);
  });

  it("makes the same sheet the download would", () => {
    const plan = sharedPlanFromJson(json)!;
    const doc = planDocument(plan.state, buildTripView(plan.state, null).dayList, plan.bookings, plan.places, plan.stations);
    expect(doc.days.map((d) => d.city)).toEqual(["Kyoto", "Kyoto", "Kyoto"]);
    expect(doc.days[1].entries.map((e) => `${e.time} ${e.kind === "stop" ? e.name : e.kind === "booking" ? e.title : "Lunch"}`)).toEqual([
      "07:00 Kiyomizu-dera", "08:30 Tea ceremony", "10:00 Kodai-ji",
    ]);
    expect(doc.days[1].entries[0]).toMatchObject({ station: "Kiyomizu-Gojo", stationWalkMin: 15, clashesWith: ["Tea ceremony"] });
  });

  it("refuses anything that isn't the expected shape, rather than showing part of it", () => {
    expect(sharedPlanFromJson(null)).toBeNull();
    expect(sharedPlanFromJson({ ...json, days: "none" })).toBeNull();
    expect(sharedPlanFromJson({ ...json, trip: { ...json.trip, status: "secret" } })).toBeNull();
  });
});
