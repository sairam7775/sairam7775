import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { rateLimit } from "../rate-limit";

/** The bucket arithmetic lives in `take_rate_token` (0012) and needs a
 *  database to exercise. What is testable here is the wrapper's contract:
 *  the shape it hands back, and that it fails closed rather than waving a
 *  request through when the limiter cannot answer. */
function stub(response: { data?: unknown; error?: unknown }): SupabaseClient {
  return { rpc: async () => response } as unknown as SupabaseClient;
}

const row = { allowed: true, remaining: 19, retry_after_ms: 0 };

describe("rateLimit", () => {
  it("reads the row PostgREST returns for a set-returning function", async () => {
    expect(await rateLimit(stub({ data: [row] }), "chat")).toEqual({
      allowed: true,
      remaining: 19,
      retryAfterMs: 0,
    });
  });

  it("reads a bare row too, so a single-object response is not misparsed", async () => {
    expect(await rateLimit(stub({ data: row }), "chat")).toEqual({
      allowed: true,
      remaining: 19,
      retryAfterMs: 0,
    });
  });

  it("passes a refusal through with the wait, in camelCase", async () => {
    const result = await rateLimit(
      stub({ data: [{ allowed: false, remaining: 0, retry_after_ms: 2400 }] }),
      "parse",
    );
    expect(result).toEqual({ allowed: false, remaining: 0, retryAfterMs: 2400 });
  });

  it("fails closed when the database errors", async () => {
    const boom = new Error("connection refused");
    await expect(rateLimit(stub({ error: boom }), "chat")).rejects.toThrow(boom);
  });

  it("fails closed on an empty result rather than reading undefined", async () => {
    await expect(rateLimit(stub({ data: [] }), "chat")).rejects.toThrow(/no row/);
    await expect(rateLimit(stub({ data: null }), "chat")).rejects.toThrow(/no row/);
  });
});
