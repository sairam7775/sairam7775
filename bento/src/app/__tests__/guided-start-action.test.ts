import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), insert: vi.fn(), single: vi.fn(), savePreferences: vi.fn(), revalidatePath: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({ insert: (row: unknown) => { mocks.insert(row); return { select: () => ({ single: mocks.single }) }; } }),
  }),
}));
vi.mock("@/lib/bento-man/store.supabase", () => ({
  SupabaseStore: class { savePreferences = mocks.savePreferences; },
}));

import { startGuidedTrip } from "../trips/actions";

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.single.mockResolvedValue({ data: { id: "t1" }, error: null });
  mocks.savePreferences.mockResolvedValue({});
});

describe("startGuidedTrip", () => {
  it("creates the trip, saves pace and interests, and hands back the first message", async () => {
    const r = await startGuidedTrip(null, form({ when: "rough", month: "2026-11", nights: "10", people: "2", pace: "relaxed", interests: ["food", "onsen"], places: "Kyoto" }));
    expect(mocks.insert).toHaveBeenCalledWith({ user_id: "u1", title: "November 2026, about 10 nights", start_date: null, end_date: null, party_size: 2 });
    expect(mocks.savePreferences).toHaveBeenCalledWith({ pace: "relaxed", interestTags: ["food", "onsen"] });
    expect(r).toEqual({ ok: true, tripId: "t1", starter: "About 10 nights in November 2026, 2 of us. Places in mind: Kyoto. Can you suggest a route?" });
  });

  it("saves known dates on the trip and leaves preferences alone when none were chosen", async () => {
    await startGuidedTrip(null, form({ when: "dates", startDate: "2026-11-20", endDate: "2026-11-29", people: "1" }));
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ start_date: "2026-11-20", end_date: "2026-11-29", title: null }));
    expect(mocks.savePreferences).not.toHaveBeenCalled();
  });

  it("says what's wrong, and creates nothing, for a rough plan with no month", async () => {
    const r = await startGuidedTrip(null, form({ when: "rough", people: "1" }));
    expect(r).toEqual({ ok: false, error: copy.trips.guided.errors.month });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("still starts the trip if saving preferences fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.savePreferences.mockRejectedValue(new Error("down"));
    const r = await startGuidedTrip(null, form({ when: "unsure", people: "1", pace: "packed" }));
    expect(r?.ok).toBe(true);
  });

  it("sends a signed-out visitor to sign in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(startGuidedTrip(null, form({ when: "unsure" }))).rejects.toThrow("redirect:/sign-in");
  });
});
