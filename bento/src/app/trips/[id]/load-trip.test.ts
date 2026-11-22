import { describe, expect, it, vi } from "vitest";
import type { TripState } from "@/lib/bento-man/store";
import { DEFAULT_PREFS } from "@/lib/bento-man/store";

const chat = vi.hoisted(() => ({ loadChat: vi.fn() }));
vi.mock("./load-chat", () => chat);

import { readTrip } from "./load-trip";

const state: TripState = {
  trip: { id: "trip", title: null, startDate: null, endDate: null, partySize: 1, status: "planning" },
  prefs: { ...DEFAULT_PREFS },
  cities: [{ cityId: "kyoto-city", name: "Kyoto", tier: "deep", nights: 2, sortOrder: 0, budgetBand: null, reason: null, arriveDate: null, departDate: null }],
  days: [],
  pendingProposal: null,
};

/** Every other read answers like PostgREST: a value, never a throw. */
function fakeDb() {
  const tables: string[] = [];
  const from = (table: string) => {
    tables.push(table);
    const q = Object.assign(Promise.resolve({ data: table === "bookings" ? [{ id: "b1" }] : null, error: null }), {
      select: () => q, eq: () => q, order: () => q, maybeSingle: () => q,
    });
    return q;
  };
  return { db: { from } as never, tables };
}

describe("readTrip", () => {
  it("answers null for a trip it can't read, even when the chat failed too, so the page is a 404", async () => {
    chat.loadChat.mockRejectedValueOnce(new Error("chat failed"));
    const { db } = fakeDb();
    await expect(readTrip(db, { state: () => Promise.reject(new Error("trip not found")) }, "trip")).resolves.toBeNull();
  });

  it("throws the chat's failure once the trip was read", async () => {
    chat.loadChat.mockRejectedValueOnce(new Error("chat failed"));
    const { db } = fakeDb();
    await expect(readTrip(db, { state: async () => state }, "trip")).rejects.toThrow("chat failed");
  });

  it("starts every read at once and hands the chat the route's cities", async () => {
    chat.loadChat.mockImplementationOnce(async (_db, _id, route) => ({ messages: [], cityNames: Object.fromEntries((await route).map((c: { id: string; name: string }) => [c.id, c.name])), cityTiers: {} }));
    const { db, tables } = fakeDb();
    const read = await readTrip(db, { state: async () => state }, "trip");
    expect(tables.sort()).toEqual(["bookings", "gap_dismissals", "trip_reviews", "trip_shares"]);
    expect(read?.state).toBe(state);
    expect(read?.chat.cityNames).toEqual({ "kyoto-city": "Kyoto" });
    expect(read?.bookingRows).toEqual([{ id: "b1" }]);
  });
});
