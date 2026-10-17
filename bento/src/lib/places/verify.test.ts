import { describe, expect, it } from "vitest";
import { missingForVerify } from "./verify";

describe("missingForVerify", () => {
  it("passes a record with a duration, a tag and a source", () => {
    expect(missingForVerify({ duration_typical_min: 90, interest_tags: ["shrines"], sources: ["visit"] })).toEqual([]);
  });

  it("names everything a record is missing", () => {
    expect(missingForVerify({ duration_typical_min: null, interest_tags: [], sources: null })).toEqual([
      "a typical duration",
      "at least one interest tag",
      "at least one source",
    ]);
  });

  it("treats a zero duration and a missing record as unverifiable", () => {
    expect(missingForVerify({ duration_typical_min: 0, interest_tags: ["food"], sources: ["x"] })).toEqual(["a typical duration"]);
    expect(missingForVerify(null)).toHaveLength(3);
  });
});
