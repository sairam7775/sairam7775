import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  tripMaybeSingle: vi.fn(),
  shareInsert: vi.fn(),
  shareDeleteEq: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

import { renewShareLink, shareTrip } from "./actions";
import { copy } from "@/copy";

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
  mocks.rpc.mockResolvedValue({ data: "0123456789abcdef0123456789abcdef", error: null });
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

    expect(mocks.shareInsert).toHaveBeenCalledWith({ trip_id: TRIP_ID, expires_at: "2026-11-27T12:30:00.000Z", until_trip_end: false });
  });

  it("stores until the trip ends as the choice, so it follows later date changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:30:00.000Z"));

    await expect(shareTrip(form({ tripId: TRIP_ID, expiryOption: "trip-end" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?share=1#share`);

    expect(mocks.shareInsert).toHaveBeenCalledWith({ trip_id: TRIP_ID, expires_at: null, until_trip_end: true });
  });

  it("refuses until the trip ends for a trip that is over, before touching the link", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-28T00:00:00.000Z"));

    await expect(shareTrip(form({ tripId: TRIP_ID, expiryOption: "trip-end" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?error=`);

    expect(mocks.shareInsert).not.toHaveBeenCalled();
    expect(mocks.shareDeleteEq).not.toHaveBeenCalled();
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

describe("making a new link", () => {
  it("replaces the link in one database call, with the expiry the server derives", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:30:00.000Z"));

    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "30-days", expires_at: "1999-01-01T00:00:00Z" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?share=1#share`);

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenCalledWith("renew_trip_share", {
      p_trip: TRIP_ID,
      p_expires_at: "2026-12-20T12:30:00.000Z",
      p_until_trip_end: false,
    });
    // No separate delete and insert: a failed insert can't leave the trip unshared.
    expect(mocks.shareDeleteEq).not.toHaveBeenCalled();
    expect(mocks.shareInsert).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalledWith("trip_shares");
  });

  it("passes until the trip ends as the choice", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T12:30:00.000Z"));

    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "trip-end", from: "print" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}/print`);

    expect(mocks.rpc).toHaveBeenCalledWith("renew_trip_share", { p_trip: TRIP_ID, p_expires_at: null, p_until_trip_end: true });
  });

  it("shows the failure when the database refuses, never the new link", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "refused" } });

    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "never" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?error=${encodeURIComponent(copy.share.renewFailed)}#share`);
  });

  it("shows the failure when the call returns no token", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });

    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "never" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?error=${encodeURIComponent(copy.share.renewFailed)}#share`);
  });

  it("refuses before the call: an unknown choice, a trip the traveller can't see, until the end of an ended trip", async () => {
    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "3-days" }))).rejects.toThrow(/^redirect:\/trips$/);

    mocks.tripMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "never" }))).rejects.toThrow(/^redirect:\/trips$/);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-28T00:00:00.000Z"));
    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "trip-end" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?error=`);

    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.shareDeleteEq).not.toHaveBeenCalled();
    expect(mocks.shareInsert).not.toHaveBeenCalled();
  });
});

describe("what counts as a new link", () => {
  const renewFailed = `redirect:/trips/${TRIP_ID}?error=${encodeURIComponent(copy.share.renewFailed)}#share`;

  it("refuses a token that isn't 32 hex characters, and refreshes nothing", async () => {
    for (const token of ["not-a-token", "0123456789ABCDEF0123456789ABCDEF", "abc", 42, { token: "x" }]) {
      mocks.rpc.mockResolvedValueOnce({ data: token, error: null });
      await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "never" }))).rejects.toThrow(renewFailed);
    }
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refreshes the trip page and the download after a new link", async () => {
    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "never" })))
      .rejects.toThrow(`redirect:/trips/${TRIP_ID}?share=1#share`);

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${TRIP_ID}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${TRIP_ID}/print`);
  });

  it("refreshes nothing when the database refuses until the trip ends", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "trip has ended" } });

    await expect(renewShareLink(form({ tripId: TRIP_ID, expiryOption: "never" }))).rejects.toThrow(renewFailed);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
