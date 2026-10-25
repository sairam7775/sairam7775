import { describe, expect, it, vi } from "vitest";
import { deleteAccountData, postHogDeleter } from "./delete";

/** A stand-in for the service-role client that records what was asked. */
function fakeAdmin(opts: { unlinkError?: string; deleteError?: string; queueError?: string } = {}) {
  const calls: string[] = [];
  const admin = {
    from: (table: string) => ({
      upsert: async (values: Record<string, unknown>, options: { onConflict: string }) => {
        calls.push(`upsert ${table} ${JSON.stringify(values)} on ${options.onConflict}`);
        return { error: opts.queueError ? { message: opts.queueError } : null };
      },
      delete: () => ({
        eq: async (col: string, val: string) => {
          calls.push(`delete ${table} where ${col}=${val}`);
          return { error: null };
        },
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (col: string, val: string) => {
          calls.push(`update ${table} ${JSON.stringify(values)} where ${col}=${val}`);
          return { error: opts.unlinkError ? { message: opts.unlinkError } : null };
        },
      }),
    }),
    auth: {
      admin: {
        deleteUser: async (id: string) => {
          calls.push(`deleteUser ${id}`);
          return { error: opts.deleteError ? { message: opts.deleteError } : null };
        },
      },
    },
  };
  return { admin: admin as never, calls };
}

describe("deleteAccountData", () => {
  it("unlinks costs, deletes the user, queues the retry, deletes analytics, then clears the retry", async () => {
    const { admin, calls } = fakeAdmin();
    const signals: (AbortSignal | undefined)[] = [];
    const analytics = vi.fn(async (id: string, signal?: AbortSignal) => {
      calls.push(`analytics ${id}`);
      signals.push(signal);
    });
    const r = await deleteAccountData(admin, "u1", analytics);
    expect(calls).toEqual([
      'update api_usage {"user_id":null} where user_id=u1',
      "deleteUser u1",
      'upsert analytics_deletions {"user_id":"u1"} on user_id',
      "analytics u1",
      "delete analytics_deletions where user_id=u1",
    ]);
    expect(r).toEqual({ analyticsDeleted: true, analyticsPending: null });
    // Every try carries a time limit, so a stalled PostHog can't hold the page.
    expect(signals[0]).toBeInstanceOf(AbortSignal);
  });

  it("leaves the retry queued before the first try, so a request cut off midway still has a record", async () => {
    const { admin, calls } = fakeAdmin();
    // A try that never ends stands for the server stopping during it.
    void deleteAccountData(admin, "u1", () => new Promise<void>(() => {}));
    await vi.waitFor(() => expect(calls).toContain('upsert analytics_deletions {"user_id":"u1"} on user_id'));
    expect(calls.some((c) => c.startsWith("delete analytics_deletions"))).toBe(false);
  });

  it("still deletes the account when analytics deletion keeps failing, and keeps it queued for the daily retry", async () => {
    const { admin, calls } = fakeAdmin();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await deleteAccountData(admin, "u1", async () => {
      throw new Error("down");
    }, { wait: async () => {} });
    expect(calls).toEqual([
      'update api_usage {"user_id":null} where user_id=u1',
      "deleteUser u1",
      'upsert analytics_deletions {"user_id":"u1"} on user_id',
    ]);
    expect(r).toEqual({ analyticsDeleted: false, analyticsPending: "retrying" });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("still deletes the account when the queue can't be written, and says it will be done by hand", async () => {
    const { admin, calls } = fakeAdmin({ queueError: "unavailable" });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await deleteAccountData(admin, "u1", async () => {
      throw new Error("down");
    }, { wait: async () => {} });
    expect(calls).toContain("deleteUser u1");
    expect(r).toEqual({ analyticsDeleted: false, analyticsPending: "by-hand" });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("delete it by hand"), "unavailable");
    log.mockRestore();
  });

  it("tries the analytics deletion again before giving up", async () => {
    const { admin } = fakeAdmin();
    let tries = 0;
    const waits: number[] = [];
    const r = await deleteAccountData(admin, "u1", async () => {
      if (++tries < 3) throw new Error("busy");
    }, { wait: async (ms) => { waits.push(ms); } });
    expect(tries).toBe(3);
    expect(waits).toEqual([500, 1500]);
    expect(r).toEqual({ analyticsDeleted: true, analyticsPending: null });
  });

  it("has nothing pending where analytics deletion isn't set up", async () => {
    const { admin } = fakeAdmin();
    expect(await deleteAccountData(admin, "u1", null)).toEqual({ analyticsDeleted: false, analyticsPending: null });
  });

  it("stops before deleting anything if costs can't be unlinked", async () => {
    const { admin, calls } = fakeAdmin({ unlinkError: "nope" });
    await expect(deleteAccountData(admin, "u1", null)).rejects.toThrow(/api_usage/);
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("reports a failed user deletion and leaves analytics and the queue alone", async () => {
    const { admin, calls } = fakeAdmin({ deleteError: "boom" });
    const analytics = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(deleteAccountData(admin, "u1", analytics, { wait: async () => {} })).rejects.toThrow(/auth: boom/);
    expect(analytics).not.toHaveBeenCalled();
    expect(calls.some((c) => c.startsWith("upsert"))).toBe(false);
  });
});

describe("postHogDeleter", () => {
  it("is off without a personal key and project id", () => {
    expect(postHogDeleter({})).toBeNull();
    expect(postHogDeleter({ POSTHOG_PERSONAL_API_KEY: "k" })).toBeNull();
  });

  it("finds the person by the account id and deletes them with their events", async () => {
    const seen: string[] = [];
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      seen.push(`${init?.method ?? "GET"} ${url}`);
      if (!init?.method) return new Response(JSON.stringify({ results: [{ id: "p-9" }] }));
      return new Response(null, { status: 204 });
    });
    const del = postHogDeleter({ POSTHOG_PERSONAL_API_KEY: "k", POSTHOG_PROJECT_ID: "42" }, fetcher as unknown as typeof fetch)!;
    await del("u1");
    expect(seen).toEqual([
      "GET https://eu.posthog.com/api/projects/42/persons/?distinct_id=u1",
      "DELETE https://eu.posthog.com/api/projects/42/persons/p-9/?delete_events=true",
    ]);
    expect((fetcher.mock.calls[0][1] as RequestInit).headers).toEqual({ Authorization: "Bearer k" });
  });

  it("passes the time limit to both PostHog requests", async () => {
    const signal = new AbortController().signal;
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method ? new Response(null, { status: 204 }) : new Response(JSON.stringify({ results: [{ id: "p-9" }] })),
    );
    const del = postHogDeleter({ POSTHOG_PERSONAL_API_KEY: "k", POSTHOG_PROJECT_ID: "42" }, fetcher as unknown as typeof fetch)!;
    await del("u1", signal);
    expect(fetcher.mock.calls.map((c) => (c[1] as RequestInit).signal)).toEqual([signal, signal]);
  });

  it("throws when PostHog refuses, so the failure is logged", async () => {
    const fetcher = vi.fn(async () => new Response("no", { status: 401 }));
    const del = postHogDeleter({ POSTHOG_PERSONAL_API_KEY: "k", POSTHOG_PROJECT_ID: "42" }, fetcher as unknown as typeof fetch)!;
    await expect(del("u1")).rejects.toThrow(/401/);
  });
});
