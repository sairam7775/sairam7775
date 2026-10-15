import { describe, expect, it } from "vitest";
import { inPasswordReset } from "./auth-config";

describe("inPasswordReset", () => {
  it("counts only for the user the reset link signed in", () => {
    expect(inPasswordReset("user-a", "user-a")).toBe(true);
    expect(inPasswordReset("user-a", "user-b")).toBe(false);
  });

  it("is false without a cookie or a user", () => {
    expect(inPasswordReset(undefined, "user-a")).toBe(false);
    expect(inPasswordReset("user-a", undefined)).toBe(false);
    expect(inPasswordReset("", "")).toBe(false);
  });
});
