import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { isSupabaseTimeout, READ_TIMEOUT_MS, timedFetch, WRITE_TIMEOUT_MS } from "./timeout";

/** A server that never answers: the request ends only when its signal aborts. */
const hanging = vi.fn<typeof fetch>((_input, init) => new Promise((_resolve, reject) => {
  init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
}));

describe("timedFetch", () => {
  it("gives reads less time than writes, and enough for a slow RPC", () => {
    expect(READ_TIMEOUT_MS).toBe(10_000);
    expect(WRITE_TIMEOUT_MS).toBe(15_000);
  });

  it("cuts off a read that hangs", async () => {
    const f = timedFetch(hanging, { readMs: 20, writeMs: 5_000 });
    const error = await f("https://db.example/rest/v1/trips").catch((e) => e);
    // An abort, so postgrest-js doesn't retry it (it retries other failed reads).
    expect(error.name).toBe("AbortError");
    expect(error.message).toBe("Supabase request timed out after 20 ms");
  });

  it("gives a write (an RPC is a POST) the longer limit", async () => {
    const f = timedFetch(hanging, { readMs: 10, writeMs: 30 });
    const write = await f("https://db.example/rest/v1/rpc/apply_proposal", { method: "POST" }).catch((e) => e);
    const read = await f("https://db.example/rest/v1/trips", { method: "get" }).catch((e) => e);
    expect(write.message).toBe("Supabase request timed out after 30 ms");
    expect(read.message).toBe("Supabase request timed out after 10 ms");
  });

  it("cuts off a response body that stalls, with the same error", async () => {
    const stalls = vi.fn<typeof fetch>(async (_input, init) => new Response(new ReadableStream({
      start(controller) { init?.signal?.addEventListener("abort", () => controller.error(init.signal!.reason)); },
    })));
    const response = await timedFetch(stalls, { readMs: 20, writeMs: 20 })("https://db.example/rest/v1/trips");
    const error = await response.text().catch((e) => e);
    expect(error.name).toBe("AbortError");
    expect(isSupabaseTimeout(error)).toBe(true);
  });

  it("tells a timeout from other errors, as an Error or as PostgREST's error object", () => {
    expect(isSupabaseTimeout({ message: "AbortError: Supabase request timed out after 15000 ms", code: "" })).toBe(true);
    expect(isSupabaseTimeout(new DOMException("Supabase request timed out after 10000 ms", "AbortError"))).toBe(true);
    expect(isSupabaseTimeout(new Error("write failed"))).toBe(false);
    expect(isSupabaseTimeout({ message: "the trip dates changed meanwhile", code: "P0001" })).toBe(false);
    expect(isSupabaseTimeout(null)).toBe(false);
  });

  it("still honours the caller's own signal", async () => {
    const own = new AbortController();
    const f = timedFetch(hanging, { readMs: 5_000, writeMs: 5_000 });
    const pending = f("https://db.example/rest/v1/trips", { signal: own.signal }).catch((e) => e);
    own.abort(new Error("caller gave up"));
    expect((await pending).message).toBe("caller gave up");
  });

  it("surfaces as the store's existing error path, once: the read's error is thrown, not retried", async () => {
    hanging.mockClear();
    const db = createClient("https://db.example", "anon-key", { global: { fetch: timedFetch(hanging, { readMs: 20, writeMs: 20 }) } });
    const error = await new SupabaseStore(db, "b8ca68c7-0e71-41b6-9e4c-3c244dc2e135", "user-id").history(5).catch((e) => e);
    expect(String(error.message)).toBe("AbortError: Supabase request timed out after 20 ms");
    expect(hanging).toHaveBeenCalledTimes(1);
  });

  it("leaves a fast failure to postgrest-js's own retries", async () => {
    const refused = vi.fn<typeof fetch>(async () => { throw new TypeError("fetch failed"); });
    const f = timedFetch(refused, { readMs: 5_000, writeMs: 5_000 });
    const error = await f("https://db.example/rest/v1/trips").catch((e) => e);
    expect(error).toBeInstanceOf(TypeError);
  });
});
