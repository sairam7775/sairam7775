import { describe, expect, it } from "vitest";
import { ageOn, ageStatus, secondsUntilEligible, AGE_BLOCKED_COOKIE, AGE_OK_COOKIE, MIN_AGE } from "./age-gate";
import { copy } from "@/copy";

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
  it("the cut-off is 16", () => {
    expect(MIN_AGE).toBe(16);
  });
  it("the privacy page and the terms state the same age", () => {
    expect(copy.privacy.sections.children.body).toContain(`aged ${MIN_AGE} and over`);
    expect(copy.terms.sections.account.body).toContain(`be ${MIN_AGE} or older`);
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

describe("secondsUntilEligible", () => {
  it("runs out on the 16th birthday, not a year later", () => {
    // Born 2010-10-14: turns 16 at 00:00 UTC tomorrow, 12 hours after `today`.
    expect(secondsUntilEligible("2010-10-14", today)).toBe(12 * 60 * 60);
    expect(ageOn("2010-10-14", new Date(today.getTime() + 12 * 60 * 60 * 1000))).toBe(MIN_AGE);
  });
  it("a 29 February birthday turns over on 29 February, 16 years on being a leap year", () => {
    const eligible = new Date(today.getTime() + secondsUntilEligible("2012-02-29", today) * 1000);
    expect(eligible.toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(ageOn("2012-02-29", eligible)).toBe(MIN_AGE);
  });
});
