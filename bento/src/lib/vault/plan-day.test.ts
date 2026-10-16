import { describe, expect, it } from "vitest";
import { bookingDates, bookingSlot, canPlanOn, clashes } from "./plan-day";

const dinner = { startsAt: "2027-04-06T19:00:00.000Z", endsAt: "2027-04-06T21:00:00.000Z" };
const hotel = { startsAt: "2027-04-05T15:00:00.000Z", endsAt: "2027-04-09T11:00:00.000Z" };
const dateOnly = { startsAt: "2027-04-07T00:00:00.000Z", endsAt: null };

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
  it("starts and ends on a same-day booking", () => {
    expect(bookingSlot(dinner, "2027-04-06")).toEqual({ startMin: 19 * 60, endMin: 21 * 60, part: "starts" });
  });

  it("check-in on the first day, check-out on the last, all day between", () => {
    expect(bookingSlot(hotel, "2027-04-05")).toEqual({ startMin: 15 * 60, endMin: null, part: "starts" });
    expect(bookingSlot(hotel, "2027-04-09")).toEqual({ startMin: 11 * 60, endMin: null, part: "ends" });
    expect(bookingSlot(hotel, "2027-04-07")).toEqual({ startMin: null, endMin: null, part: "all-day" });
  });

  it("treats a date with no time as all day", () => {
    expect(bookingSlot(dateOnly, "2027-04-07")).toEqual({ startMin: null, endMin: null, part: "all-day" });
  });
});

describe("clashes", () => {
  const slot = { startMin: 12 * 60, endMin: 13 * 60 };
  it("flags a stop that overlaps the booking", () => {
    expect(clashes({ startMin: 11 * 60 + 30, durationMin: 60 }, slot)).toBe(true);
    expect(clashes({ startMin: 12 * 60 + 30, durationMin: 15 }, slot)).toBe(true);
  });

  it("lets a stop end exactly when the booking starts", () => {
    expect(clashes({ startMin: 11 * 60, durationMin: 60 }, slot)).toBe(false);
    expect(clashes({ startMin: 13 * 60, durationMin: 60 }, slot)).toBe(false);
  });

  it("treats a booking with no end as a moment", () => {
    expect(clashes({ startMin: 14 * 60, durationMin: 90 }, { startMin: 15 * 60, endMin: null })).toBe(true);
    expect(clashes({ startMin: 15 * 60, durationMin: 30 }, { startMin: 15 * 60, endMin: null })).toBe(true);
    expect(clashes({ startMin: 13 * 60, durationMin: 60 }, { startMin: 15 * 60, endMin: null })).toBe(false);
  });

  it("never flags an untimed stop or an all-day booking", () => {
    expect(clashes({ startMin: null, durationMin: 60 }, slot)).toBe(false);
    expect(clashes({ startMin: 12 * 60, durationMin: 60 }, { startMin: null, endMin: null })).toBe(false);
  });
});
