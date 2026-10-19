import { describe, expect, it } from "vitest";
import { summariseDateRange } from "./date-range-summary";

describe("summariseDateRange", () => {
  it("summarises both dates with the night count", () => {
    expect(summariseDateRange("2026-11-20", "2026-11-29")).toEqual({
      kind: "range",
      start: "2026-11-20",
      end: "2026-11-29",
      nights: 9,
    });
  });

  it("summarises an arrival date on its own", () => {
    expect(summariseDateRange("2026-11-20", "")).toEqual({ kind: "arrival", date: "2026-11-20" });
  });

  it("summarises a departure date on its own", () => {
    expect(summariseDateRange("", "2026-11-29")).toEqual({ kind: "departure", date: "2026-11-29" });
  });

  it("shows no summary when neither date is set", () => {
    expect(summariseDateRange("", "")).toBeNull();
  });

  it("allows a same-day visit with zero nights", () => {
    expect(summariseDateRange("2026-11-20", "2026-11-20")).toMatchObject({ kind: "range", nights: 0 });
  });

  it("identifies an end date before the start date", () => {
    expect(summariseDateRange("2026-11-20", "2026-11-19")).toEqual({ kind: "endBeforeStart" });
  });

  it("counts nights across the end of a year", () => {
    expect(summariseDateRange("2026-12-30", "2027-01-03")).toMatchObject({ kind: "range", nights: 4 });
  });
});
