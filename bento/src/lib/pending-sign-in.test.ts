import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openPendingSignIn, PENDING_SIGN_IN_TTL_S, sealPendingSignIn, type PendingSignIn } from "./pending-sign-in";

const held: PendingSignIn = {
  refreshToken: "r3fr3sh-t0ken",
  userId: "8f52ecc8-0000-4000-8000-000000000000",
  email: "traveller@example.com",
  next: "/settings/password",
};
const NOW = Date.UTC(2026, 9, 30, 12);

describe("pending sign-in", () => {
  const saved = { service: process.env.SUPABASE_SERVICE_ROLE_KEY, secret: process.env.BENTO_AUTH_SECRET };
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    delete process.env.BENTO_AUTH_SECRET;
  });
  afterEach(() => {
    for (const [name, value] of [["SUPABASE_SERVICE_ROLE_KEY", saved.service], ["BENTO_AUTH_SECRET", saved.secret]] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("opens what it sealed", () => {
    expect(openPendingSignIn(sealPendingSignIn(held, NOW)!, NOW)).toEqual(held);
  });

  it("keeps the refresh token and the address out of the cookie's text", () => {
    const sealed = sealPendingSignIn(held, NOW)!;
    expect(sealed).not.toContain(held.refreshToken);
    expect(sealed).not.toContain("traveller");
    expect(Buffer.from(sealed.replace(/\./g, ""), "base64url").toString("latin1")).not.toContain("traveller");
  });

  it("is refused once the wait is over", () => {
    const sealed = sealPendingSignIn(held, NOW)!;
    expect(openPendingSignIn(sealed, NOW + (PENDING_SIGN_IN_TTL_S - 1) * 1000)).toEqual(held);
    expect(openPendingSignIn(sealed, NOW + (PENDING_SIGN_IN_TTL_S + 1) * 1000)).toBeNull();
  });

  it("is refused when any part is changed by a single bit", () => {
    const parts = sealPendingSignIn(held, NOW)!.split(".");
    for (let i = 0; i < parts.length; i++) {
      const bytes = Buffer.from(parts[i], "base64url");
      bytes[0] ^= 1;
      const changed = parts.map((p, j) => (j === i ? bytes.toString("base64url") : p)).join(".");
      expect(openPendingSignIn(changed, NOW)).toBeNull();
    }
  });

  it("is refused under another server key", () => {
    const sealed = sealPendingSignIn(held, NOW)!;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "another-service-role";
    expect(openPendingSignIn(sealed, NOW)).toBeNull();
  });

  it("refuses junk without throwing", () => {
    for (const junk of [undefined, "", "a.b", "a.b.c", "...", "x".repeat(5000)]) {
      expect(openPendingSignIn(junk, NOW)).toBeNull();
    }
  });

  it("holds nothing without a server key", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(sealPendingSignIn(held, NOW)).toBeNull();
  });
});
