import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { globalMonthlyCapUsd, monthlyCapUsd, reserveProjectSpend, reserveSpend, SpendCapExceeded } from "../spend";

/** A stand-in for the service-role client that answers the two RPCs. */
function fakeAdmin(row: Record<string, unknown> | null, settleError: { message: string } | null = null) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "reserve_spend") return { data: row ? [row] : [], error: null };
      return { data: null, error: settleError };
    },
  } as unknown as SupabaseClient;
  return { admin, calls };
}

const granted = { reservation_id: 7, refused: null, user_spent: "1.5", global_spent: "9" };

afterEach(() => vi.unstubAllEnvs());

describe("caps", () => {
  it("default to $20 per user and $50 overall, and ignore nonsense", () => {
    expect(monthlyCapUsd()).toBe(20);
    expect(globalMonthlyCapUsd()).toBe(50);
    vi.stubEnv("BENTO_MONTHLY_SPEND_CAP_USD", "-3");
    vi.stubEnv("BENTO_GLOBAL_MONTHLY_SPEND_CAP_USD", "abc");
    expect(monthlyCapUsd()).toBe(20);
    expect(globalMonthlyCapUsd()).toBe(50);
  });
});

describe("reserveSpend", () => {
  it("sends the estimate and both caps to the database, which decides", async () => {
    vi.stubEnv("BENTO_MONTHLY_SPEND_CAP_USD", "8");
    vi.stubEnv("BENTO_GLOBAL_MONTHLY_SPEND_CAP_USD", "30");
    const { admin, calls } = fakeAdmin(granted);
    await reserveSpend("u1", "chat", 0.85, admin);
    expect(calls[0]).toEqual({
      fn: "reserve_spend",
      args: { p_user: "u1", p_kind: "chat", p_estimate: 0.85, p_user_cap: 8, p_global_cap: 30 },
    });
  });

  it("refuses when the user's own cap is reached", async () => {
    const { admin } = fakeAdmin({ reservation_id: null, refused: "user", user_spent: "20.1", global_spent: "25" });
    const err = await reserveSpend("u1", "chat", 0.5, admin).catch((e) => e);
    expect(err).toBeInstanceOf(SpendCapExceeded);
    expect(err.scope).toBe("user");
    expect(err.message).toMatch(/\$20\.10 of \$20\.00/);
  });

  it("refuses when the shared budget is used up, without blaming the user", async () => {
    const { admin } = fakeAdmin({ reservation_id: null, refused: "global", user_spent: "0.5", global_spent: "50" });
    const err = await reserveSpend("u1", "parse", 0.5, admin).catch((e) => e);
    expect(err).toBeInstanceOf(SpendCapExceeded);
    expect(err.scope).toBe("global");
    expect(err.message).not.toMatch(/\$0\.50/);
  });

  it("fails closed when the database errors or answers nothing", async () => {
    const broken = { rpc: async () => ({ data: null, error: new Error("db down") }) } as unknown as SupabaseClient;
    await expect(reserveSpend("u1", "chat", 0.5, broken)).rejects.toThrow("db down");
    await expect(reserveSpend("u1", "chat", 0.5, fakeAdmin(null).admin)).rejects.toThrow(/no row/);
  });
});

describe("settle", () => {
  it("swaps the estimate for the real usage, once", async () => {
    const { admin, calls } = fakeAdmin(granted);
    const hold = await reserveSpend("u1", "chat", 0.5, admin);
    const usage = { model: "claude-opus-5", inputTokens: 1000, outputTokens: 200, cachedTokens: 50, costUsd: 0.012 };
    await hold.settle(usage);
    await hold.settle(usage);
    const settles = calls.filter((c) => c.fn === "settle_spend");
    expect(settles).toHaveLength(1);
    expect(settles[0].args).toMatchObject({ p_id: 7, p_input_tokens: 1000, p_output_tokens: 200, p_cost: 0.012 });
  });

  it("a call that never reached the model settles with zero tokens, so it leaves nothing", async () => {
    const { admin, calls } = fakeAdmin(granted);
    await (await reserveSpend("u1", "parse", 0.5, admin)).settle(null);
    expect(calls.at(-1)?.args).toMatchObject({ p_id: 7, p_input_tokens: 0, p_output_tokens: 0, p_cost: 0 });
  });

  it("a failed settle doesn't throw into the response", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin } = fakeAdmin(granted, { message: "boom" });
    const hold = await reserveSpend("u1", "chat", 0.5, admin);
    await expect(hold.settle(null)).resolves.toBeUndefined();
    spy.mockRestore();
  });
});

describe("reserveProjectSpend", () => {
  it("holds against the project's cap alone, with no user", async () => {
    vi.stubEnv("BENTO_MONTHLY_SPEND_CAP_USD", "8");
    vi.stubEnv("BENTO_GLOBAL_MONTHLY_SPEND_CAP_USD", "30");
    const { admin, calls } = fakeAdmin(granted);
    await reserveProjectSpend("draft", 0.2, admin);
    expect(calls[0]).toEqual({
      fn: "reserve_spend",
      args: { p_user: null, p_kind: "draft", p_estimate: 0.2, p_user_cap: 30, p_global_cap: 30 },
    });
  });

  it("refuses as the shared budget when it is used up", async () => {
    const { admin } = fakeAdmin({ reservation_id: null, refused: "user", user_spent: "50", global_spent: "50" });
    const err = await reserveProjectSpend("draft", 0.2, admin).catch((e) => e);
    expect(err).toBeInstanceOf(SpendCapExceeded);
    expect(err.scope).toBe("global");
  });
});
