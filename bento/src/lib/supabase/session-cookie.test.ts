import { createServerClient } from "@supabase/ssr";
import { describe, expect, it, vi } from "vitest";
import { mayHaveSession } from "./session-cookie";

const named = (...names: string[]) => names.map((name) => ({ name, value: "x" }));

describe("mayHaveSession", () => {
  it("is false with no cookies, or only Bento's own", () => {
    expect(mayHaveSession([])).toBe(false);
    expect(mayHaveSession(named("bento_theme", "bento_analytics", "bento_season", "bento_tour", "bento_age"))).toBe(false);
  });

  it("is true for a Supabase session cookie, whole or in chunks", () => {
    expect(mayHaveSession(named("sb-abcdefgh-auth-token"))).toBe(true);
    expect(mayHaveSession(named("bento_theme", "sb-abcdefgh-auth-token.0", "sb-abcdefgh-auth-token.1"))).toBe(true);
  });

  it("errs towards checking: any Supabase auth cookie counts, a sign-in's code verifier too", () => {
    expect(mayHaveSession(named("sb-abcdefgh-auth-token-code-verifier"))).toBe(true);
  });

  it("ignores a cookie that only looks alike", () => {
    expect(mayHaveSession(named("xsb-abcdefgh-auth-token", "sb-auth-token", "my-auth-token"))).toBe(false);
  });
});

// The check is only a shortcut if Supabase itself agrees: with none of these
// cookies, getUser() answers "signed out" without asking Supabase, and with
// one it does ask. Checked against the real client, not a copy of its rules.
describe("mayHaveSession agrees with the Supabase client", () => {
  const URL = "https://abcdefgh.supabase.co";

  function client(cookies: { name: string; value: string }[]) {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ message: "nope" }), { status: 401 }));
    const supabase = createServerClient(URL, "anon-key", {
      global: { fetch },
      cookies: { getAll: () => cookies, setAll: () => {} },
    });
    return { supabase, fetch };
  }

  const session = {
    access_token: "header.payload.signature",
    refresh_token: "refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "0b7e4c1a-1111-4222-8333-944445555666", aud: "authenticated" },
  };
  const sessionCookie = { name: "sb-abcdefgh-auth-token", value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}` };

  it("no session cookie: signed out, and no request to Supabase", async () => {
    const cookies = [{ name: "bento_theme", value: "dark" }, { name: "bento_analytics", value: "yes" }];
    expect(mayHaveSession(cookies)).toBe(false);
    const { supabase, fetch } = client(cookies);
    const { data } = await supabase.auth.getUser();
    expect(data.user).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("a session cookie: the shortcut defers, and the client asks Supabase", async () => {
    const cookies = [sessionCookie];
    expect(mayHaveSession(cookies)).toBe(true);
    const { supabase, fetch } = client(cookies);
    await supabase.auth.getUser();
    expect(fetch).toHaveBeenCalled();
  });
});
