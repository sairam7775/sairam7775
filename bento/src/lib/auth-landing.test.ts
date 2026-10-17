import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { isWrongBrowser, landSignedIn, linkFailed } from "./auth-landing";
import { PASSWORD_RESET_COOKIE } from "./auth-config";
import { copy } from "@/copy";

const ORIGIN = "https://bento.test";
const user = { id: "8f52ecc8-0000-4000-8000-000000000000" } as User;
const errorOf = (res: Response) => new URL(res.headers.get("location")!).searchParams.get("error");

describe("auth landing", () => {
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
  beforeEach(() => { process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role"; });
  afterEach(() => {
    if (saved === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  });

  it("recognises a link opened in another browser", () => {
    expect(isWrongBrowser({ code: "bad_code_verifier" })).toBe(true);
    expect(isWrongBrowser({ code: "pkce_code_verifier_not_found" })).toBe(true);
    expect(isWrongBrowser({ code: "otp_expired" })).toBe(false);
    expect(isWrongBrowser(null)).toBe(false);
  });

  it("sends a failed reset link back to forgot-password, saying why", () => {
    const expired = linkFailed(ORIGIN, "/settings/password");
    expect(expired.headers.get("location")).toMatch(/^https:\/\/bento\.test\/forgot-password\?/);
    expect(errorOf(expired)).toBe(copy.auth.errors.resetLinkUsed);
    expect(errorOf(linkFailed(ORIGIN, "/settings/password", true))).toBe(copy.auth.errors.linkOtherBrowser(true));
  });

  it("sends any other failed link to sign-in", () => {
    const res = linkFailed(ORIGIN, "/trips");
    expect(res.headers.get("location")).toMatch(/^https:\/\/bento\.test\/sign-in\?/);
    expect(errorOf(res)).toBe(copy.auth.errors.signInLinkUsed);
  });

  it("marks a reset landing so the old password isn't asked for", () => {
    const res = landSignedIn(ORIGIN, "/settings/password", user);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/settings/password`);
    expect(res.cookies.get(PASSWORD_RESET_COOKIE)?.value).toMatch(new RegExp(`^${user.id}\.`));
  });

  it("clears the reset marker on any other landing", () => {
    const res = landSignedIn(ORIGIN, "/trips", user);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/trips`);
    expect(res.cookies.get(PASSWORD_RESET_COOKIE)?.value).toBe("");
  });
});
