import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  tripMaybeSingle: vi.fn(),
  shareInsert: vi.fn(),
  shareDeleteEq: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

import { shareTrip } from "./actions";

const TRIP_ID = "11111111-1111-4111-8111-111111111111";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.tripMaybeSingle.mockResolvedValue({ data: { end_date: "2026-11-27" }, error: null });
  mocks.shareInsert.mockResolvedValue({ error: null });
  mocks.shareDeleteEq.mockResolvedValue({ error: null });
  mocks.from.mockImplementation((table: string) => table === "trips"
    ? { select: () => ({ eq: () => ({ maybeSingle: mocks.tripMaybeSingle }) }) }
    : { insert: mocks.shareInsert, delete: () => ({ eq: mocks.shareDeleteEq }) });
});

afterEach(() => vi.useRealTimers());

describe("sharing a trip", () => {
  it("derives the stored expiry from the choice, ignoring any client timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:30:00.000Z"));

    await expect(shareTrip(form({ tripId: TRIP_ID, expiryOption: "7-days", expires_at: "1999-01-01T00:00:00Z" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?share=1#share`);

    expect(mocks.shareInsert).toHaveBeenCalledWith({ trip_id: TRIP_ID, expires_at: "2026-11-27T12:30:00.000Z" });
  });

  it("refuses an unknown expiry option", async () => {
    await expect(shareTrip(form({ tripId: TRIP_ID, expiryOption: "3-days" }))).rejects.toThrow("redirect:/trips");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.shareInsert).not.toHaveBeenCalled();
  });

  it("refuses trip-end expiry when the stored trip has no end date", async () => {
    mocks.tripMaybeSingle.mockResolvedValue({ data: { end_date: null }, error: null });

    await expect(shareTrip(form({ tripId: TRIP_ID, expiryOption: "trip-end" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?error=`);

    expect(mocks.shareInsert).not.toHaveBeenCalled();
  });
});
