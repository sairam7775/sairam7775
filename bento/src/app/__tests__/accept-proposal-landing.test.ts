import { beforeEach, describe, expect, it, vi } from "vitest";

const TRIP = "11111111-1111-4111-8111-111111111111";
const MSG = "22222222-2222-4222-8222-222222222222";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), revalidatePath: vi.fn(), applyProposal: vi.fn(), parseProposal: vi.fn(),
  citiesBefore: 0,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/bento-man/diff", () => ({ parseProposal: mocks.parseProposal }));
vi.mock("@/lib/bento-man/store.supabase", () => ({
  SupabaseStore: class { applyProposal = mocks.applyProposal; },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      // A chain that ignores filters: each table answers one way.
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: { proposed_diff: {} } }),
        then: (ok: (v: unknown) => unknown) => ok(table === "trip_cities" ? { count: mocks.citiesBefore, error: null } : { data: null, error: null }),
      };
      return chain;
    },
  }),
}));

import { acceptProposal } from "../trips/[id]/actions";

const form = () => {
  const f = new FormData();
  f.set("tripId", TRIP);
  f.set("messageId", MSG);
  return f;
};
const route = { kind: "route", before: [], after: [], summary: "", verdict: "fine", arithmetic: "" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.applyProposal.mockResolvedValue(undefined);
  mocks.citiesBefore = 0;
});

describe("acceptProposal: where the traveller lands", () => {
  it("opens Bookings after the trip's first route", async () => {
    mocks.parseProposal.mockReturnValue({ summary: "", route, days: [] });
    await expect(acceptProposal(form())).rejects.toThrow(`redirect:/trips/${TRIP}/vault?welcome=1`);
    expect(mocks.applyProposal).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/trips/${TRIP}/vault`);
  });

  it("stays on the plan when the trip already had a route", async () => {
    mocks.citiesBefore = 2;
    mocks.parseProposal.mockReturnValue({ summary: "", route, days: [] });
    await expect(acceptProposal(form())).resolves.toBeUndefined();
  });

  it("stays on the plan for a proposal with no route (days only)", async () => {
    mocks.parseProposal.mockReturnValue({ summary: "", days: [] });
    await expect(acceptProposal(form())).resolves.toBeUndefined();
  });

  it("does not open Bookings when applying failed", async () => {
    mocks.parseProposal.mockReturnValue({ summary: "", route, days: [] });
    mocks.applyProposal.mockRejectedValue(new Error("moved"));
    await expect(acceptProposal(form())).rejects.toThrow(`redirect:/trips/${TRIP}?error=`);
  });
});
