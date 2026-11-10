import { describe, expect, it } from "vitest";
import { authCookieOptions } from "./cookie-options";

/** Every Supabase client in Bento runs on the server (the browser never
 *  talks to Supabase), so the session cookies can be hidden from page
 *  scripts. These pin that, so a script injected into a page can't read
 *  someone's session and sign in as them elsewhere. */
describe("authCookieOptions", () => {
  it("hides the session cookies from page scripts", () => {
    expect(authCookieOptions("production").httpOnly).toBe(true);
    expect(authCookieOptions("development").httpOnly).toBe(true);
  });

  it("sends them over https only in production", () => {
    expect(authCookieOptions("production").secure).toBe(true);
  });

  it("still works on http://localhost in development", () => {
    expect(authCookieOptions("development").secure).toBe(false);
  });

  it("keeps them same-site, so other sites can't post with them", () => {
    expect(authCookieOptions("production").sameSite).toBe("lax");
  });
});
