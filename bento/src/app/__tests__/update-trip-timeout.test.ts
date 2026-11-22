/** Editing a trip when the database doesn't answer in time: the traveller
 *  never sees the raw timeout, and a write that may have landed says so. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), setTripDates: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock("@/lib/bento-man/store.supabase", () => ({ SupabaseStore: class { setTripDates = mocks.setTripDates; } }));

import { updateTrip } from "../trips/actions";
import { OutcomeUnknownError } from "@/lib/bento-man/store";

const TRIP = "11111111-1111-4111-8111-111111111111";
const back = `/trips/${TRIP}`;
const form = () => {
  const f = new FormData();
  f.set("id", TRIP);
  f.set("title", "Kansai");
  f.set("startDate", "2026-11-20");
  f.set("endDate", "2026-11-29");
  f.set("partySize", "2");
  return f;
};
const landing = async () => decodeURIComponent((await updateTrip(form()).then(() => "", (e: Error) => e.message)));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
});

describe("updateTrip when the database didn't answer in time", () => {
  it("says the change can't be confirmed, and refreshes the trip so it shows what is saved", async () => {
    mocks.setTripDates.mockRejectedValue(new OutcomeUnknownError(copy.plan.dates.outcomeUnknown));
    expect(await landing()).toBe(`redirect:${back}?error=${copy.plan.dates.outcomeUnknown}`);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(back);
  });

  it("never shows the raw timeout text from a read", async () => {
    mocks.setTripDates.mockRejectedValue(Object.assign(new Error("AbortError: Supabase request timed out after 10000 ms"), { code: "" }));
    const to = await landing();
    expect(to).toBe(`redirect:${back}?error=${copy.trips.errors.saveFailed}`);
    expect(to).not.toContain("AbortError");
  });

  it("still shows the store's own refusals", async () => {
    mocks.setTripDates.mockRejectedValue(new Error(copy.plan.dates.changedMeanwhile));
    expect(await landing()).toBe(`redirect:${back}?error=${copy.plan.dates.changedMeanwhile}`);
  });
});
