import { describe, expect, it } from "vitest";
import { detectGaps, nightsOf, type BookingRow, type GapCity, type GapInput, type GapPlace } from "../gaps";

const cities: GapCity[] = [
  { cityId: "osaka-city", name: "Osaka", nights: 2, sortOrder: 0, arriveDate: "2026-11-20", departDate: "2026-11-22" },
  { cityId: "kyoto-city", name: "Kyoto", nights: 5, sortOrder: 1, arriveDate: "2026-11-22", departDate: "2026-11-27" },
  { cityId: "hiroshima-city", name: "Hiroshima", nights: 2, sortOrder: 2, arriveDate: "2026-11-27", departDate: "2026-11-29" },
];

const hotel = (title: string, from: string, to: string, cityId: string): BookingRow => ({
  id: title, type: "accommodation", title, startsOn: from, endsOn: to, cityId, toCityId: null, placeId: null,
});

const base = (over: Partial<GapInput> = {}): GapInput => ({
  startDate: "2026-11-20",
  endDate: "2026-11-29",
  cities,
  bookings: [],
  places: [],
  today: "2026-09-16",
  dismissed: new Set<string>(),
  ...over,
});

describe("nightsOf", () => {
  it("counts nights, not days — the last date is a departure", () => {
    expect(nightsOf("2026-11-20", "2026-11-29")).toHaveLength(9);
    expect(nightsOf("2026-11-20", "2026-11-21")).toEqual(["2026-11-20"]);
    expect(nightsOf("2026-11-20", "2026-11-20")).toEqual([]);
    expect(nightsOf(null, "2026-11-29")).toEqual([]);
  });
});

describe("detectGaps — a bed for every night", () => {
  it("names the night, where it is, and what it sits between", () => {
    const r = detectGaps(base({
      bookings: [
        hotel("Hotel Kanra", "2026-11-20", "2026-11-22", "osaka-city"),
        hotel("Kyoto Machiya", "2026-11-22", "2026-11-26", "kyoto-city"),
        hotel("Miyajima ryokan", "2026-11-27", "2026-11-29", "hiroshima-city"),
      ],
    }));
    const bed = r.gaps.find((g) => g.key.startsWith("bed:"))!;
    expect(bed.severity).toBe("blocking");
    expect(bed.title).toBe("You have nowhere to sleep on the night of 26 November in Kyoto.");
    expect(bed.detail).toMatch(/Kyoto Machiya runs through the 25 Nov/);
    expect(bed.detail).toMatch(/Miyajima ryokan starts on the 27 Nov/);
    expect(r.coveredNights).toBe(8);
    expect(r.totalNights).toBe(9);
    expect(r.blocking).toBe(1);
  });

  it("runs consecutive uncovered nights together as one sentence", () => {
    const r = detectGaps(base({ bookings: [hotel("Hotel Kanra", "2026-11-20", "2026-11-22", "osaka-city")] }));
    const beds = r.gaps.filter((g) => g.key.startsWith("bed:"));
    expect(beds).toHaveLength(1);
    expect(beds[0].title).toMatch(/^You have nowhere to sleep on 7 nights, 22 November to 28 November in Kyoto\./);
  });

  it("is quiet when every night has a bed", () => {
    const r = detectGaps(base({
      bookings: [
        hotel("Hotel Kanra", "2026-11-20", "2026-11-22", "osaka-city"),
        hotel("Kyoto Machiya", "2026-11-22", "2026-11-27", "kyoto-city"),
        hotel("Miyajima ryokan", "2026-11-27", "2026-11-29", "hiroshima-city"),
      ],
    }));
    expect(r.gaps.filter((g) => g.key.startsWith("bed:"))).toEqual([]);
    expect(r.coveredNights).toBe(9);
    expect(r.blocking).toBe(0);
  });

  it("has no nights at all without dates, and raises nothing about beds", () => {
    const r = detectGaps(base({ startDate: null, endDate: null }));
    expect(r.nights).toEqual([]);
    expect(r.gaps.filter((g) => g.key.startsWith("bed:"))).toEqual([]);
  });
});

describe("detectGaps — tickets", () => {
  const teamlab: GapPlace = { placeId: "osk-teamlab-botanical", name: "teamLab Botanical Garden", date: "2026-11-21", bookingReq: "required", bookingLeadDays: 14 };

  it("a required ticket with none recorded blocks, and says the planner will leave it out", () => {
    const r = detectGaps(base({ places: [teamlab] }));
    const g = r.gaps.find((x) => x.key.startsWith("ticket:"))!;
    expect(g.severity).toBe("blocking");
    expect(g.title).toMatch(/teamLab Botanical Garden needs a ticket/);
    expect(g.detail).toMatch(/leave it out of the day until a booking exists/);
  });

  it("becomes 'closing' once the lead window is in reach", () => {
    const r = detectGaps(base({ places: [teamlab], today: "2026-11-10" }));
    const g = r.gaps.find((x) => x.key.startsWith("ticket:"))!;
    expect(g.severity).toBe("closing");
    expect(g.daysLeft).toBe(11);
  });

  it("a place that needs no booking is never a gap", () => {
    const r = detectGaps(base({
      places: [{ placeId: "kyt-fushimi-inari", name: "Fushimi Inari", date: "2026-11-23", bookingReq: "none", bookingLeadDays: null }],
    }));
    expect(r.gaps.filter((g) => g.key.startsWith("ticket"))).toEqual([]);
  });

  it("a recommended booking is raised only while there is time to act", () => {
    const rec: GapPlace = { placeId: "osk-kaiyukan", name: "Kaiyukan", date: "2026-11-21", bookingReq: "recommended", bookingLeadDays: 7 };
    expect(detectGaps(base({ places: [rec] })).gaps.filter((g) => g.key.startsWith("ticket-soon"))).toEqual([]);
    const near = detectGaps(base({ places: [rec], today: "2026-11-18" }));
    expect(near.gaps.find((g) => g.key.startsWith("ticket-soon"))!.severity).toBe("closing");
  });

  it("a held ticket closes the gap", () => {
    const r = detectGaps(base({
      places: [teamlab],
      bookings: [{ id: "b1", type: "activity", title: "teamLab", startsOn: "2026-11-21", endsOn: null, cityId: "osaka-city", toCityId: null, placeId: "osk-teamlab-botanical" }],
    }));
    expect(r.gaps.filter((g) => g.key.startsWith("ticket"))).toEqual([]);
  });
});

describe("detectGaps — moves and dismissals", () => {
  it("raises an unbooked city change as worth knowing, not blocking", () => {
    const r = detectGaps(base());
    const moves = r.gaps.filter((g) => g.key.startsWith("move:"));
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.severity === "worth_knowing")).toBe(true);
    expect(moves[0].detail).toMatch(/IC card and no reservation/);
  });

  it("a booked move stops being a gap", () => {
    const r = detectGaps(base({
      bookings: [{ id: "t1", type: "transport", title: "Nozomi", startsOn: "2026-11-27", endsOn: null, cityId: "kyoto-city", toCityId: "hiroshima-city", placeId: null }],
    }));
    expect(r.gaps.filter((g) => g.key === "move:kyoto-city:hiroshima-city")).toEqual([]);
  });

  it("a dismissed gap moves out of the live list but is kept", () => {
    const live = detectGaps(base());
    const key = live.gaps[0].key;
    const after = detectGaps(base({ dismissed: new Set([key]) }));
    expect(after.gaps.map((g) => g.key)).not.toContain(key);
    expect(after.dismissed.map((g) => g.key)).toContain(key);
  });

  it("sorts blocking first, then closing, then worth knowing", () => {
    const r = detectGaps(base({
      places: [{ placeId: "p", name: "teamLab", date: "2026-11-21", bookingReq: "required", bookingLeadDays: null }],
    }));
    const sev = r.gaps.map((g) => g.severity);
    expect(sev.indexOf("blocking")).toBeLessThan(sev.lastIndexOf("worth_knowing"));
  });
});
