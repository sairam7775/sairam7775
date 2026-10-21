import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { postHogDeleter } from "@/lib/account/delete";
import { GET } from "./route";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/account/delete", () => ({ postHogDeleter: vi.fn() }));

type Row = { user_id: string; attempts: number };

function fakeAdmin(rows: Row[]) {
  const selected: unknown[] = [];
  const updated: { values: Record<string, unknown>; userId: string }[] = [];
  const deleted: string[] = [];
  const admin = {
    from: (table: string) => ({
      select: (columns: string) => ({
        lt: (column: string, value: number) => {
          const orders: { column: string; ascending: boolean }[] = [];
          const chain = {
            order: (orderColumn: string, options: { ascending: boolean }) => {
              orders.push({ column: orderColumn, ascending: options.ascending });
              return chain;
            },
            limit: async (limit: number) => {
              selected.push({ table, columns, column, value, orders, limit });
              return { data: rows, error: null };
            },
          };
          return chain;
        },
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async (column: string, userId: string) => {
          updated.push({ values: { ...values, column }, userId });
          return { error: null };
        },
      }),
      delete: () => ({
        eq: async (_column: string, userId: string) => {
          deleted.push(userId);
          return { error: null };
        },
      }),
    }),
  };
  vi.mocked(createAdminClient).mockReturnValue(admin as never);
  return { selected, updated, deleted };
}

function request(authorization?: string) {
  return new Request("http://localhost/api/cron/analytics-deletions", {
    headers: authorization ? { authorization } : undefined,
  });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "posthog-key");
  vi.stubEnv("POSTHOG_PROJECT_ID", "42");
  vi.mocked(createAdminClient).mockReset();
  vi.mocked(postHogDeleter).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/cron/analytics-deletions", () => {
  it("refuses missing and incorrect bearer secrets", async () => {
    const missing = await GET(request());
    const wrong = await GET(request("Bearer wrong"));

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(postHogDeleter).not.toHaveBeenCalled();
  });

  it("returns 503 and does nothing when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ done: 0, failed: 0, given_up: 0 });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(postHogDeleter).not.toHaveBeenCalled();
  });

  it("leaves rows alone and returns zero counts when PostHog is not configured", async () => {
    vi.mocked(postHogDeleter).mockReturnValue(null);
    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ done: 0, failed: 0, given_up: 0 });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("deletes successes, records failures, and stops after ten attempts", async () => {
    const rows = [
      { user_id: "u-done", attempts: 0 },
      { user_id: "u-retry", attempts: 3 },
      { user_id: "u-give-up", attempts: 9 },
    ];
    const db = fakeAdmin(rows);
    const longError = "x".repeat(230);
    vi.mocked(postHogDeleter).mockReturnValue(async (userId) => {
      if (userId !== "u-done") throw new Error(longError);
    });
    const manualFollowUpLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(request("Bearer cron-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ done: 1, failed: 1, given_up: 1 });
    expect(Object.keys(body).sort()).toEqual(["done", "failed", "given_up"]);
    expect(db.selected).toEqual([{
      table: "analytics_deletions",
      columns: "user_id, attempts",
      column: "attempts",
      value: 10,
      orders: [{ column: "attempts", ascending: true }, { column: "queued_at", ascending: true }],
      limit: 200,
    }]);
    expect(db.deleted).toEqual(["u-done"]);
    expect(db.updated).toEqual([
      { values: { attempts: 4, last_error: longError.slice(0, 200), column: "user_id" }, userId: "u-retry" },
      { values: { attempts: 10, last_error: longError.slice(0, 200), column: "user_id" }, userId: "u-give-up" },
    ]);
    expect(manualFollowUpLog).toHaveBeenCalledWith(
      "Analytics deletion reached 10 attempts; manual follow-up is needed.",
    );
  });

  it("stops when the time budget is used and leaves the rest for the next run", async () => {
    const db = fakeAdmin([
      { user_id: "u-first", attempts: 0 },
      { user_id: "u-later", attempts: 0 },
    ]);
    const deleteAnalytics = vi.fn(async () => {});
    vi.mocked(postHogDeleter).mockReturnValue(deleteAnalytics);
    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(1_000).mockReturnValue(46_000);
    const outOfTimeLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(request("Bearer cron-secret"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ done: 1, failed: 0, given_up: 0 });
    expect(deleteAnalytics).toHaveBeenCalledTimes(1);
    expect(db.deleted).toEqual(["u-first"]);
    expect(outOfTimeLog).toHaveBeenCalledWith(
      "Analytics deletion retries ran out of time; the rest wait for the next run.",
    );
  });
});
