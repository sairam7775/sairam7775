import { describe, expect, it } from "vitest";
import { rateLimit } from "../rate-limit";

const opts = { limit: 3, windowMs: 60_000 };

describe("rateLimit", () => {
  it("allows requests up to the limit", () => {
    const key = `allow-${Math.random()}`;
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
  });

  it("refuses once the bucket is empty", () => {
    const key = `refuse-${Math.random()}`;
    for (let i = 0; i < opts.limit; i++) rateLimit(key, opts);

    const result = rateLimit(key, opts);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("keeps users separate", () => {
    const a = `user-a-${Math.random()}`;
    const b = `user-b-${Math.random()}`;
    for (let i = 0; i < opts.limit; i++) rateLimit(a, opts);

    expect(rateLimit(a, opts).allowed).toBe(false);
    expect(rateLimit(b, opts).allowed).toBe(true);
  });

  it("reports remaining capacity", () => {
    const key = `remaining-${Math.random()}`;
    expect(rateLimit(key, opts).remaining).toBe(2);
    expect(rateLimit(key, opts).remaining).toBe(1);
    expect(rateLimit(key, opts).remaining).toBe(0);
  });
});
