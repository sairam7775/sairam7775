import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";
import { PASSWORD_RESET_COOKIE } from "@/lib/auth-config";
import { PENDING_SIGN_IN_COOKIE, sealPendingSignIn } from "@/lib/pending-sign-in";

const mocks = vi.hoisted(() => ({ refreshSession: vi.fn(), cookieGet: vi.fn(), cookieSet: vi.fn(), cookieDelete: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, set: mocks.cookieSet, delete: mocks.cookieDelete }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { refreshSession: mocks.refreshSession } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/account/delete", () => ({ deleteAccountData: vi.fn(), postHogDeleter: vi.fn() }));

import { cancelSignIn, confirmSignIn } from "../(auth)/actions";

const USER_ID = "8f52ecc8-0000-4000-8000-000000000000";
const holding = (next: string) => {
  const value = sealPendingSignIn({ refreshToken: "rt-1", userId: USER_ID, email: "a@example.com", next });
  mocks.cookieGet.mockImplementation((name: string) => (name === PENDING_SIGN_IN_COOKIE ? { value } : undefined));
};
// The Continue form, carrying the account its page showed.
const shown = (account = USER_ID) => {
  const form = new FormData();
  form.set("account", account);
  return form;
};
const redirectOf =(action: Promise<unknown>) => action.then(() => "", (e: Error) => e.message);
const heldCookieCleared = () => expect(mocks.cookieDelete).toHaveBeenCalledWith({ name: PENDING_SIGN_IN_COOKIE, path: "/auth" });

describe("confirming an email link's account", () => {
  const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
    mocks.refreshSession.mockResolvedValue({ data: { user: { id: USER_ID }, session: {} }, error: null });
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
  });

  it("signs in with the held session and lands where the link was going", async () => {
    holding("/trips");
    await expect(confirmSignIn(shown())).rejects.toThrow("redirect:/trips");
    expect(mocks.refreshSession).toHaveBeenCalledWith({ refresh_token: "rt-1" });
    heldCookieCleared();
    expect(mocks.cookieDelete).toHaveBeenCalledWith(PASSWORD_RESET_COOKIE);
  });

  it("marks a reset link's landing so the old password isn't asked for", async () => {
    holding("/settings/password");
    await expect(confirmSignIn(shown())).rejects.toThrow("redirect:/settings/password");
    expect(mocks.cookieSet).toHaveBeenCalledWith(PASSWORD_RESET_COOKIE, expect.stringMatching(new RegExp(`^${USER_ID}\\.`)), expect.anything());
  });

  it("sends a visitor whose wait ran out back to sign in, signing nothing in", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    const thrown = await redirectOf(confirmSignIn(shown()));
    expect(thrown).toMatch(/^redirect:\/sign-in\?/);
    expect(new URLSearchParams(thrown.split("?")[1]).get("error")).toBe(copy.auth.errors.signInLinkUsed);
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });

  it("says a reset link has expired when its held session no longer works", async () => {
    holding("/settings/password");
    mocks.refreshSession.mockResolvedValue({ data: { user: null, session: null }, error: { code: "refresh_token_not_found" } });
    const thrown = await redirectOf(confirmSignIn(shown()));
    expect(thrown).toMatch(/^redirect:\/forgot-password\?/);
    expect(new URLSearchParams(thrown.split("?")[1]).get("error")).toBe(copy.auth.errors.resetLinkUsed);
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("won't sign in to an account other than the one the page showed", async () => {
    // Another link was opened in a second tab after this page was shown.
    holding("/trips");
    await expect(confirmSignIn(shown("00000000-0000-4000-8000-000000000bad"))).rejects.toThrow("redirect:/auth/confirm");
    expect(mocks.refreshSession).not.toHaveBeenCalled();
    // Kept, so the page now shows the account that is actually waiting.
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
  });

  it("drops the held sign-in when it isn't theirs", async () => {
    holding("/trips");
    await expect(cancelSignIn()).rejects.toThrow("redirect:/sign-in");
    heldCookieCleared();
    expect(mocks.refreshSession).not.toHaveBeenCalled();
  });
});
