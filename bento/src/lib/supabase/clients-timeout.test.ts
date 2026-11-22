/** Every server-side Supabase client is built with the timed fetch, so one
 *  slow dependency can't hang a page or a chat turn. */
import { afterEach, describe, expect, it, vi } from "vitest";

const ssr = vi.hoisted(() => ({ createServerClient: vi.fn(() => ({ auth: { getUser: async () => ({ data: { user: null } }) } })) }));
const js = vi.hoisted(() => ({ createClient: vi.fn(() => ({})) }));
vi.mock("@supabase/ssr", () => ssr);
vi.mock("@supabase/supabase-js", () => js);
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

import { supabaseFetch } from "./timeout";
import { createClient } from "./server";
import { createAdminClient } from "./admin";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const fetchOf = (options: unknown) => (options as { global?: { fetch?: unknown } }).global?.fetch;

describe("server-side Supabase clients", () => {
  it("the signed-in user's client uses the timed fetch", async () => {
    await createClient();
    expect(fetchOf((ssr.createServerClient.mock.calls[0] as unknown[])[2])).toBe(supabaseFetch);
  });

  it("the service-role client uses the timed fetch", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    createAdminClient();
    expect(fetchOf((js.createClient.mock.calls[0] as unknown[])[2])).toBe(supabaseFetch);
  });

  it("the proxy's session refresh uses the timed fetch", async () => {
    const { proxy } = await import("@/proxy");
    const { NextRequest } = await import("next/server");
    await proxy(new NextRequest("http://localhost/"));
    expect(fetchOf((ssr.createServerClient.mock.calls[0] as unknown[])[2])).toBe(supabaseFetch);
  });
});
