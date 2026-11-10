import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import type { cookies } from "next/headers";
import { holdForConfirmation, isWrongBrowser, landSignedIn, linkFailed, markLanding } from "./auth-landing";
import { PASSWORD_RESET_COOKIE } from "./auth-config";
import { openPendingSignIn, PENDING_SIGN_IN_COOKIE } from "./pending-sign-in";
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

  it("holds an email link's sign-in for the visitor to confirm, signing nothing in yet", () => {
    const res = holdForConfirmation(ORIGIN, "/settings/password", { refresh_token: "rt-1" } as Session, { ...user, email: "a@example.com" });
    expect(res.headers.get("location")).toBe(`${ORIGIN}/auth/confirm`);
    const held = res.cookies.get(PENDING_SIGN_IN_COOKIE)!;
    expect(held).toMatchObject({ path: "/auth", httpOnly: true, sameSite: "lax" });
    expect(openPendingSignIn(held.value)).toEqual({ refreshToken: "rt-1", userId: user.id, email: "a@example.com", next: "/settings/password" });
    // The reset marker waits for the confirmation too.
    expect(res.cookies.get(PASSWORD_RESET_COOKIE)).toBeUndefined();
  });

  it("lands as before when a link gives no session to hold", () => {
    const res = holdForConfirmation(ORIGIN, "/trips", null, null);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/trips`);
    expect(res.cookies.get(PENDING_SIGN_IN_COOKIE)).toBeUndefined();
  });

  it("refuses to hold a sign-in it couldn't encrypt", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = holdForConfirmation(ORIGIN, "/trips", { refresh_token: "rt-1" } as Session, { ...user, email: "a@example.com" });
    expect(res.headers.get("location")).toMatch(/^https:\/\/bento\.test\/sign-in\?/);
    expect(errorOf(res)).toBe(copy.auth.serverError);
    expect(res.cookies.get(PENDING_SIGN_IN_COOKIE)).toBeUndefined();
  });

  it("marks or clears the reset landing in a server action's cookie jar", () => {
    const set = vi.fn();
    const del = vi.fn();
    const jar = { set, delete: del } as unknown as Awaited<ReturnType<typeof cookies>>;
    markLanding(jar, "/settings/password", user.id);
    expect(set).toHaveBeenCalledWith(PASSWORD_RESET_COOKIE, expect.stringMatching(new RegExp(`^${user.id}\\.`)), expect.objectContaining({ httpOnly: true, path: "/" }));
    markLanding(jar, "/trips", user.id);
    expect(del).toHaveBeenCalledWith(PASSWORD_RESET_COOKIE);
  });
});
