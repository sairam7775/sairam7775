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

  // The proxy clears a dead session by setting its cookie to "" on the
  // request the page then reads: that is no session.
  it("ignores an emptied session cookie", () => {
    expect(mayHaveSession([{ name: "sb-abcdefgh-auth-token", value: "" }])).toBe(false);
    expect(mayHaveSession([{ name: "sb-abcdefgh-auth-token.0", value: "" }, { name: "sb-abcdefgh-auth-token.1", value: "" }])).toBe(false);
  });
});

// The name it looks for must be the one Bento's own client writes. If the
// client's cookie name ever changed (a custom storage key in
// cookie-options.ts), every visitor would be drawn signed out on the home
// page: this fails first.
describe("mayHaveSession knows the cookie name Bento's client uses", () => {
  it("matches createClient's storage key, whole and in chunks", async () => {
    vi.resetModules();
    vi.doMock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcdefghijklmnopqrst.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    try {
      const { createClient } = await import("./server");
      const key = ((await createClient()).auth as unknown as { storageKey: string }).storageKey;
      expect(key).toBe("sb-abcdefghijklmnopqrst-auth-token");
      expect(mayHaveSession([{ name: key, value: "base64-x" }])).toBe(true);
      expect(mayHaveSession([{ name: `${key}.0`, value: "base64-x" }])).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.doUnmock("next/headers");
    }
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

  // An expired session whose refresh Supabase refuses (signed out elsewhere,
  // account deleted): the proxy's client clears the cookie on the request the
  // page reads, so the page draws the signed-out version at once.
  it("a dead session, after the proxy: no session", async () => {
    const expired = { ...session, expires_at: Math.floor(Date.now() / 1000) - 60 };
    const cookie = `sb-abcdefgh-auth-token=base64-${Buffer.from(JSON.stringify(expired)).toString("base64url")}`;
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "Refresh Token Not Found" }), { status: 400, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    try {
      const { NextRequest } = await import("next/server");
      const { proxy } = await import("../../proxy");
      const request = new NextRequest("http://localhost/", { headers: { cookie } });
      expect(mayHaveSession(request.cookies.getAll())).toBe(true);
      await proxy(request);
      expect(fetch).toHaveBeenCalled();
      expect(request.cookies.getAll().map((c) => c.name)).toContain("sb-abcdefgh-auth-token");
      expect(mayHaveSession(request.cookies.getAll())).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
