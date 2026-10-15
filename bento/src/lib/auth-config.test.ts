import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { inPasswordReset, PASSWORD_RESET_TTL_S, signResetMarker } from "./auth-config";

const NOW = Date.UTC(2026, 9, 15, 12);

describe("password-reset marker", () => {
  const saved = process.env.BENTO_BOOKING_REF_KEY;
  beforeEach(() => {
    process.env.BENTO_BOOKING_REF_KEY = "test-key-material";
  });
  afterEach(() => {
    process.env.BENTO_BOOKING_REF_KEY = saved;
  });

  it("counts only for the user the reset link signed in", () => {
    const marker = signResetMarker("user-a", NOW)!;
    expect(inPasswordReset(marker, "user-a", NOW)).toBe(true);
    expect(inPasswordReset(marker, "user-b", NOW)).toBe(false);
  });

  it("can't be forged from a user id", () => {
    expect(inPasswordReset("user-a", "user-a", NOW)).toBe(false);
    const [id, exp] = signResetMarker("user-a", NOW)!.split(".");
    expect(inPasswordReset(`${id}.${exp}.AAAA`, "user-a", NOW)).toBe(false);
    // Moving the expiry breaks the signature.
    const forged = signResetMarker("user-a", NOW)!.replace(`.${exp}.`, `.${Number(exp) + 9999}.`);
    expect(inPasswordReset(forged, "user-a", NOW)).toBe(false);
  });

  it("expires", () => {
    const marker = signResetMarker("user-a", NOW)!;
    expect(inPasswordReset(marker, "user-a", NOW + (PASSWORD_RESET_TTL_S + 1) * 1000)).toBe(false);
  });

  it("is off without a server key", () => {
    const marker = signResetMarker("user-a", NOW)!;
    delete process.env.BENTO_BOOKING_REF_KEY;
    expect(signResetMarker("user-a", NOW)).toBeNull();
    expect(inPasswordReset(marker, "user-a", NOW)).toBe(false);
  });
});
