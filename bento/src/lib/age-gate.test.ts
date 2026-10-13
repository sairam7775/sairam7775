import { describe, expect, it } from "vitest";
import { ageOn, ageStatus, AGE_BLOCKED_COOKIE, AGE_OK_COOKIE, MIN_AGE } from "./age-gate";

const today = new Date("2026-10-13T12:00:00Z");

describe("ageOn", () => {
  it("counts whole years, turning over on the birthday", () => {
    expect(ageOn("2013-10-13", today)).toBe(13);
    expect(ageOn("2013-10-14", today)).toBe(12);
    expect(ageOn("2000-01-01", today)).toBe(26);
  });
  it("refuses dates that can't be a real birth date", () => {
    for (const bad of ["", "2026-13-01", "2013-02-30", "13/10/2013", "2027-01-01", "1800-01-01", "abc"]) {
      expect(ageOn(bad, today), bad).toBeNull();
    }
  });
  it("the cut-off is 13", () => {
    expect(MIN_AGE).toBe(13);
  });
});

describe("ageStatus", () => {
  const jar = (o: Record<string, string>) => ({ get: (n: string) => (n in o ? { value: o[n] } : undefined) });
  it("is unknown until the visitor answers", () => expect(ageStatus(jar({}))).toBe("unknown"));
  it("is ok after an adult answer", () => expect(ageStatus(jar({ [AGE_OK_COOKIE]: "1" }))).toBe("ok"));
  it("a refusal wins, even if an ok cookie is also there", () => {
    expect(ageStatus(jar({ [AGE_BLOCKED_COOKIE]: "1", [AGE_OK_COOKIE]: "1" }))).toBe("blocked");
  });
});
