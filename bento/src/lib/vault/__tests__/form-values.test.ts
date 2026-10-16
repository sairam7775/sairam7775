import { describe, expect, it } from "vitest";
import { toFormValues } from "../parse";

const base = {
  type: "activity" as const, title: "Tea ceremony", provider: null, reference: null,
  starts_on: "2027-04-07", starts_at_time: null, ends_on: null, ends_at_time: null,
  from_place: null, to_place: null, cost_amount: null, cost_currency: null, notes: null,
};

describe("toFormValues", () => {
  it("keeps a date with no time as a date, never midnight", () => {
    expect(toFormValues(base).startsAt).toBe("2027-04-07");
  });

  it("joins a date and a time the confirmation gave", () => {
    expect(toFormValues({ ...base, starts_at_time: "14:30" }).startsAt).toBe("2027-04-07T14:30");
    expect(toFormValues({ ...base, starts_at_time: "00:00" }).startsAt).toBe("2027-04-07T00:00");
  });

  it("leaves both empty with no date", () => {
    const v = toFormValues({ ...base, starts_on: null });
    expect(v.startsAt).toBe("");
    expect(v.endsAt).toBe("");
  });
});
