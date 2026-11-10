import { describe, expect, it } from "vitest";
import { bearerMatches } from "./bearer";

describe("bearerMatches", () => {
  it("accepts the exact secret", () => {
    expect(bearerMatches("Bearer cron-secret", "cron-secret")).toBe(true);
  });

  it("refuses a wrong secret of the same length", () => {
    expect(bearerMatches("Bearer cron-secreT", "cron-secret")).toBe(false);
  });

  it("refuses a longer or shorter one", () => {
    expect(bearerMatches("Bearer cron-secret-and-more", "cron-secret")).toBe(false);
    expect(bearerMatches("Bearer cron", "cron-secret")).toBe(false);
  });

  it("refuses a missing header or one without the Bearer scheme", () => {
    expect(bearerMatches(null, "cron-secret")).toBe(false);
    expect(bearerMatches("cron-secret", "cron-secret")).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    expect(bearerMatches("Bearer ", "")).toBe(false);
  });
});
