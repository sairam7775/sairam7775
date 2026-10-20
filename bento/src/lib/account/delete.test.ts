import { describe, expect, it, vi } from "vitest";
import { deleteAccountData, postHogDeleter } from "./delete";

/** A stand-in for the service-role client that records what was asked. */
function fakeAdmin(opts: { unlinkError?: string; deleteError?: string } = {}) {
  const calls: string[] = [];
  const admin = {
    from: (table: string) => ({
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
  it("unlinks costs, deletes analytics, then deletes the user — in that order", async () => {
    const { admin, calls } = fakeAdmin();
    const analytics = vi.fn(async (id: string) => {
      calls.push(`analytics ${id}`);
    });
    const r = await deleteAccountData(admin, "u1", analytics);
    expect(calls).toEqual(['update api_usage {"user_id":null} where user_id=u1', "analytics u1", "deleteUser u1"]);
    expect(r.analyticsDeleted).toBe(true);
  });

  it("still deletes the account when analytics deletion fails, and says it is pending", async () => {
    const { admin, calls } = fakeAdmin();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await deleteAccountData(admin, "u1", async () => {
      throw new Error("down");
    }, { wait: async () => {} });
    expect(calls.at(-1)).toBe("deleteUser u1");
    expect(r).toEqual({ analyticsDeleted: false, analyticsPending: true });
    expect(log).toHaveBeenCalled();
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
    expect(r).toEqual({ analyticsDeleted: true, analyticsPending: false });
  });

  it("has nothing pending where analytics deletion isn't set up", async () => {
    const { admin } = fakeAdmin();
    expect(await deleteAccountData(admin, "u1", null)).toEqual({ analyticsDeleted: false, analyticsPending: false });
  });

  it("stops before deleting anything if costs can't be unlinked", async () => {
    const { admin, calls } = fakeAdmin({ unlinkError: "nope" });
    await expect(deleteAccountData(admin, "u1", null)).rejects.toThrow(/api_usage/);
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("reports a failed user deletion", async () => {
    const { admin } = fakeAdmin({ deleteError: "boom" });
    await expect(deleteAccountData(admin, "u1", null)).rejects.toThrow(/auth: boom/);
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

  it("throws when PostHog refuses, so the failure is logged", async () => {
    const fetcher = vi.fn(async () => new Response("no", { status: 401 }));
    const del = postHogDeleter({ POSTHOG_PERSONAL_API_KEY: "k", POSTHOG_PROJECT_ID: "42" }, fetcher as unknown as typeof fetch)!;
    await expect(del("u1")).rejects.toThrow(/401/);
  });
});
