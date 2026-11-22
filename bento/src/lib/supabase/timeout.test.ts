import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { READ_TIMEOUT_MS, timedFetch, WRITE_TIMEOUT_MS } from "./timeout";

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
    const timeouts = vi.spyOn(AbortSignal, "timeout");
    const ok = vi.fn<typeof fetch>(async () => new Response("{}"));
    const f = timedFetch(ok, { readMs: 10, writeMs: 15 });
    await f("https://db.example/rest/v1/rpc/apply_proposal", { method: "POST" });
    await f("https://db.example/rest/v1/trips", { method: "get" });
    expect(timeouts.mock.calls.map(([ms]) => ms)).toEqual([15, 10]);
    timeouts.mockRestore();
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
