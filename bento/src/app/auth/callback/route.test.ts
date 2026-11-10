import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { openPendingSignIn, PENDING_SIGN_IN_COOKIE } from "@/lib/pending-sign-in";

const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  cookieVerifyOtp: vi.fn(),
  exchangeCodeForSession: vi.fn(),
}));
// A client that keeps nothing (the link's session is only held) …
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: { verifyOtp: mocks.verifyOtp } }) }));
// … and the cookie client, which would sign this browser in.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp: mocks.cookieVerifyOtp, exchangeCodeForSession: mocks.exchangeCodeForSession } }),
}));

import { GET } from "./route";

const callback = (query: string) => GET(new NextRequest(`https://bento.test/auth/callback?${query}`));

describe("/auth/callback", () => {
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    vi.clearAllMocks();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  });

  it("holds an email link's sign-in for the visitor to confirm, without signing this browser in", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { refresh_token: "rt-1" }, user: { id: "u-1", email: "a@example.com" } },
      error: null,
    });
    const res = await callback("token_hash=abc&type=email&next=%2Ftrips");

    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: "email", token_hash: "abc" });
    expect(mocks.cookieVerifyOtp).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://bento.test/auth/confirm");
    expect(openPendingSignIn(res.cookies.get(PENDING_SIGN_IN_COOKIE)?.value)).toMatchObject({ userId: "u-1", next: "/trips" });
  });

  it("holds the next page only once it's safe", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: { session: { refresh_token: "rt-1" }, user: { id: "u-1", email: "a@example.com" } },
      error: null,
    });
    const res = await callback("token_hash=abc&type=recovery&next=https%3A%2F%2Fevil.test");
    expect(openPendingSignIn(res.cookies.get(PENDING_SIGN_IN_COOKIE)?.value)?.next).toBe("/trips");
  });

  it("sends a used or expired link back to sign in", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { session: null, user: null }, error: { code: "otp_expired" } });
    const res = await callback("token_hash=abc&type=email&next=%2Ftrips");
    expect(res.headers.get("location")).toMatch(/^https:\/\/bento\.test\/sign-in\?error=/);
    expect(res.cookies.get(PENDING_SIGN_IN_COOKIE)).toBeUndefined();
  });

  it("still signs a Google return straight in: its code only works in the browser that asked", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "u-1" } }, error: null });
    const res = await callback("code=xyz&next=%2Ftrips");
    expect(res.headers.get("location")).toBe("https://bento.test/trips");
    expect(res.cookies.get(PENDING_SIGN_IN_COOKIE)).toBeUndefined();
  });
});
