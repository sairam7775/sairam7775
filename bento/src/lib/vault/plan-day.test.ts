import { describe, expect, it } from "vitest";
import { bookingDates, bookingSlot, canPlanOn, clashes, clashingBookings } from "./plan-day";

const dinner = { startsAt: "2027-04-06T19:00:00.000Z", endsAt: "2027-04-06T21:00:00.000Z" };
const hotel = { type: "accommodation", startsAt: "2027-04-05T15:00:00.000Z", endsAt: "2027-04-09T11:00:00.000Z" };
const midnight = { type: "transport", startsAt: "2027-04-07T00:00:00.000Z", endsAt: null };
const redEye = { type: "flight", startsAt: "2027-04-06T23:00:00.000Z", endsAt: "2027-04-07T01:00:00.000Z" };

describe("which day a booking may sit on", () => {
  it("allows only the dates a booking covers", () => {
    expect(canPlanOn(dinner, "2027-04-06")).toBe(true);
    expect(canPlanOn(dinner, "2027-04-05")).toBe(false);
    expect(canPlanOn(dinner, "2027-04-07")).toBe(false);
  });

  it("allows every date of a stay, start and end included", () => {
    for (const d of ["2027-04-05", "2027-04-07", "2027-04-09"]) expect(canPlanOn(hotel, d)).toBe(true);
    expect(canPlanOn(hotel, "2027-04-04")).toBe(false);
    expect(canPlanOn(hotel, "2027-04-10")).toBe(false);
  });

  it("allows nothing for a booking with no date", () => {
    expect(bookingDates({ startsAt: null, endsAt: null })).toBeNull();
    expect(canPlanOn({ startsAt: null, endsAt: "2027-04-06T10:00:00.000Z" }, "2027-04-06")).toBe(false);
  });

  it("reads dates as stored, not in the server's time zone", () => {
    // A 23:30 departure on the 6th is the 6th, wherever this runs.
    expect(canPlanOn({ startsAt: "2027-04-06T23:30:00.000Z", endsAt: null }, "2027-04-06")).toBe(true);
    expect(canPlanOn({ startsAt: "2027-04-06T23:30:00.000Z", endsAt: null }, "2027-04-07")).toBe(false);
    // Postgres returns timestamptz with an offset; it is the same instant.
    expect(canPlanOn({ startsAt: "2027-04-06T23:30:00+00:00", endsAt: null }, "2027-04-06")).toBe(true);
  });

  it("ignores an end before the start", () => {
    expect(bookingDates({ startsAt: "2027-04-06T10:00:00.000Z", endsAt: "2027-04-05T10:00:00.000Z" })).toEqual({ first: "2027-04-06", last: "2027-04-06" });
  });
});

describe("where it sits in the box", () => {
  it("starts and ends on a same-day booking, busy between", () => {
    expect(bookingSlot(dinner, "2027-04-06")).toEqual({ startMin: 19 * 60, endMin: 21 * 60, part: "starts", busy: { from: 19 * 60, to: 21 * 60 } });
  });

  it("check-in on the first day, check-out on the last, all day between — never busy", () => {
    expect(bookingSlot(hotel, "2027-04-05")).toEqual({ startMin: 15 * 60, endMin: null, part: "starts", busy: null });
    expect(bookingSlot(hotel, "2027-04-09")).toEqual({ startMin: 11 * 60, endMin: null, part: "ends", busy: null });
    expect(bookingSlot(hotel, "2027-04-07")).toEqual({ startMin: null, endMin: null, part: "all-day", busy: null });
  });

  it("keeps a real midnight time", () => {
    expect(bookingSlot(midnight, "2027-04-07")).toEqual({ startMin: 0, endMin: null, part: "starts", busy: null });
  });

  it("an overnight flight is busy to midnight, then from midnight to landing", () => {
    expect(bookingSlot(redEye, "2027-04-06")).toEqual({ startMin: 23 * 60, endMin: null, part: "starts", busy: { from: 23 * 60, to: 24 * 60 } });
    expect(bookingSlot(redEye, "2027-04-07")).toEqual({ startMin: 60, endMin: null, part: "ends", busy: { from: 0, to: 60 } });
  });
});

describe("a long journey", () => {
  const ferry = { type: "transport", startsAt: "2027-04-06T18:00:00.000Z", endsAt: "2027-04-08T09:00:00.000Z" };
  const pass = { type: "other", startsAt: "2027-04-05T09:00:00.000Z", endsAt: "2027-04-11T09:00:00.000Z" };
  it("is busy all of a day in between", () => {
    expect(bookingSlot(ferry, "2027-04-07")).toEqual({ startMin: null, endMin: null, part: "all-day", busy: { from: 0, to: 24 * 60 } });
    expect(clashes({ startMin: 10 * 60, durationMin: 60 }, bookingSlot(ferry, "2027-04-07"))).toBe(true);
  });

  it("but a pass between its ends blocks nothing", () => {
    expect(clashes({ startMin: 10 * 60, durationMin: 60 }, bookingSlot(pass, "2027-04-07"))).toBe(false);
  });
});

describe("what the day box flags", () => {
  const ferry = { title: "Ferry", type: "transport", startsAt: "2027-04-06T18:00:00.000Z", endsAt: "2027-04-08T09:00:00.000Z", plannedOn: "2027-04-06" };
  const dinnerPlanned = { ...dinner, title: "Dinner", type: "restaurant", plannedOn: "2027-04-06" };
  const dinnerNot = { ...dinnerPlanned, plannedOn: null };
  const stay = { ...hotel, title: "Hotel", plannedOn: "2027-04-05" };
  const all = [ferry, dinnerPlanned, stay];

  it("flags a stop on the middle day of a journey", () => {
    expect(clashingBookings({ startMin: 10 * 60, durationMin: 60 }, all, "2027-04-07").map((b) => b.title)).toEqual(["Ferry"]);
  });

  it("flags against every booking the stop overlaps, and only those", () => {
    expect(clashingBookings({ startMin: 18 * 60 + 30, durationMin: 60 }, all, "2027-04-06").map((b) => b.title)).toEqual(["Ferry", "Dinner"]);
    expect(clashingBookings({ startMin: 9 * 60, durationMin: 60 }, all, "2027-04-06")).toEqual([]);
  });

  it("ignores a booking that isn't in the plan", () => {
    expect(clashingBookings({ startMin: 19 * 60, durationMin: 60 }, [dinnerNot], "2027-04-06")).toEqual([]);
  });
});

describe("clashes", () => {
  const slot = { startMin: 12 * 60, busy: { from: 12 * 60, to: 13 * 60 } };
  it("flags a stop that overlaps the booking", () => {
    expect(clashes({ startMin: 11 * 60 + 30, durationMin: 60 }, slot)).toBe(true);
    expect(clashes({ startMin: 12 * 60 + 30, durationMin: 15 }, slot)).toBe(true);
  });

  it("lets a stop end exactly when the booking starts", () => {
    expect(clashes({ startMin: 11 * 60, durationMin: 60 }, slot)).toBe(false);
    expect(clashes({ startMin: 13 * 60, durationMin: 60 }, slot)).toBe(false);
  });

  it("treats a booking with no end as a moment", () => {
    expect(clashes({ startMin: 14 * 60, durationMin: 90 }, { startMin: 15 * 60, busy: null })).toBe(true);
    expect(clashes({ startMin: 15 * 60, durationMin: 30 }, { startMin: 15 * 60, busy: null })).toBe(true);
    expect(clashes({ startMin: 13 * 60, durationMin: 60 }, { startMin: 15 * 60, busy: null })).toBe(false);
  });

  it("flags stops either side of midnight on an overnight flight", () => {
    expect(clashes({ startMin: 23 * 60 + 30, durationMin: 20 }, bookingSlot(redEye, "2027-04-06"))).toBe(true);
    expect(clashes({ startMin: 30, durationMin: 20 }, bookingSlot(redEye, "2027-04-07"))).toBe(true);
    expect(clashes({ startMin: 9 * 60, durationMin: 60 }, bookingSlot(redEye, "2027-04-07"))).toBe(false);
  });

  it("never flags an untimed stop, an all-day slot, or a stay", () => {
    expect(clashes({ startMin: null, durationMin: 60 }, slot)).toBe(false);
    expect(clashes({ startMin: 12 * 60, durationMin: 60 }, { startMin: null, busy: null })).toBe(false);
    expect(clashes({ startMin: 10 * 60, durationMin: 600 }, bookingSlot(hotel, "2027-04-07"))).toBe(false);
  });
});
