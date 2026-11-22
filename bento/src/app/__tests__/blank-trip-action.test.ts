import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), insert: vi.fn(), single: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ insert: (row: unknown) => { mocks.insert(row); return { select: () => ({ single: mocks.single }) }; } }),
  }),
}));

import { createTrip } from "../trips/actions";

const e = copy.trips.errors;

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.single.mockResolvedValue({ data: { id: "t1" }, error: null });
});

// The blank trip is a tab of "Plan a Japan trip": a refusal comes back to
// that tab with what was typed, instead of sending the traveller to /trips.
describe("createTrip", () => {
  it("creates the trip and opens it", async () => {
    await expect(createTrip(null, form({ title: "Kansai", startDate: "2026-12-01", endDate: "2026-12-05", partySize: "2" }))).rejects.toThrow("redirect:/trips/t1");
    expect(mocks.insert).toHaveBeenCalledWith({ user_id: "u1", title: "Kansai", start_date: "2026-12-01", end_date: "2026-12-05", party_size: 2 });
  });

  it("hands a validation refusal back with what was sent", async () => {
    const title = "x".repeat(121);
    const r = await createTrip(null, form({ title, startDate: "2026-12-01", endDate: "", partySize: "3" }));
    expect(r).toEqual({ error: e.longTitle, values: { title, startDate: "2026-12-01", endDate: "", partySize: "3" } });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("refuses a party outside 1 to 20 with the same words as before", async () => {
    expect((await createTrip(null, form({ partySize: "0" })))?.error).toBe(e.minPeople);
    expect((await createTrip(null, form({ partySize: "21" })))?.error).toBe(e.maxPeople);
    expect((await createTrip(null, form({ partySize: "1.5" })))?.error).toBe(e.wholePeople);
  });

  it("refuses a departure before the arrival", async () => {
    const r = await createTrip(null, form({ title: "Trip", startDate: "2026-12-05", endDate: "2026-12-01", partySize: "1" }));
    expect(r).toEqual({ error: e.endBeforeStart, values: { title: "Trip", startDate: "2026-12-05", endDate: "2026-12-01", partySize: "1" } });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("hands a database refusal back too", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: "boom", code: "XX000" } });
    const r = await createTrip(null, form({ title: "Trip", partySize: "1" }));
    expect(r?.error).toBe(copy.db.failed(e.create));
    expect(r?.values.title).toBe("Trip");
  });

  it("still sends a signed-out visitor to sign in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(createTrip(null, form({}))).rejects.toThrow("redirect:/sign-in");
  });
});
