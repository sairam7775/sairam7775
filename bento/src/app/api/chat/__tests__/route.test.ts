import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-id" } } }) } }) }));
vi.mock("@/lib/guards/rate-limit", () => ({ rateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/guards/spend", () => ({ reserveSpend: vi.fn(), SpendCapExceeded: class extends Error {} }));
import { POST } from "../route";
import { reserveSpend } from "@/lib/guards/spend";

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("chat API provider key checks", () => {
  it.each([
    ["anthropic", "ANTHROPIC_API_KEY"],
    ["gemini", "GEMINI_API_KEY"],
  ])("names the missing %s key before reserving spend", async (provider, key) => {
    vi.stubEnv("BENTO_MAN_PROVIDER", provider);
    vi.stubEnv("BENTO_MAN_MOCK", "");
    vi.stubEnv(key, "");
    // The other provider's key does not configure the selected provider.
    vi.stubEnv(key === "GEMINI_API_KEY" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY", "fake-key");
    const request = new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ tripId: "b8ca68c7-0e71-41b6-9e4c-3c244dc2e135", message: "hello" }) }) as NextRequest;
    const response = await POST(request);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe(`Bento Man isn't configured on this server yet (${key}).`);
    expect(reserveSpend).not.toHaveBeenCalled();
  });
});
