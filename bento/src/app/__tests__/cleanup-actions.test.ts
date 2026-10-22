import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), update: vi.fn(), delete: vi.fn(), eq: vi.fn(),
  revalidatePath: vi.fn(), createClient: vi.fn(), requireAdmin: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/bento-man/store.supabase", () => ({ SupabaseStore: class {} }));

import { savePlace } from "../admin/actions";
import { deleteTrip } from "../trips/actions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue({ update: mocks.update, delete: mocks.delete });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.delete.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({ from: mocks.from });
  mocks.requireAdmin.mockResolvedValue({ db: { from: mocks.from } });
});

const placeForm = () => {
  const form = new FormData();
  form.set("id", "kyt-garden");
  form.set("name", "Garden");
  form.set("category", "garden");
  return form;
};

describe("deleteTrip validation", () => {
  it.each([null, "", "not-a-uuid", new Blob(["id"])])("ignores an invalid id (%s) before querying", async (id) => {
    const form = new FormData();
    if (id !== null) form.set("id", id);
    await deleteTrip(form);
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("deletes a valid trip and revalidates the list", async () => {
    const form = new FormData();
    const id = "b7f9b26a-582f-4d0d-8273-8a1978669588";
    form.set("id", id);
    await deleteTrip(form);
    expect(mocks.from).toHaveBeenCalledWith("trips");
    expect(mocks.delete).toHaveBeenCalledOnce();
    expect(mocks.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/trips");
  });
});

describe("savePlace validation", () => {
  it("preserves optional blanks, defaults, numbers, lists and the draft reset", async () => {
    const form = placeForm();
    form.set("nameJa", "庭");
    form.set("energy", "0");
    form.set("signature", "");
    form.set("durationTypical", "90");
    form.set("costJpy", "500");
    form.set("bookingLeadDays", "0");
    form.set("sources", " first, , second ");
    form.set("seasons", "koyo, sakura");
    form.set("localTip", "Keep this text. ");
    form.append("interestTags", "nature");
    form.append("interestTags", "art");
    await expect(savePlace(form)).rejects.toThrow("redirect:/admin/places/kyt-garden?saved=1");
    expect(mocks.update).toHaveBeenCalledWith({
      name: "Garden", name_ja: "庭", category: "garden", interest_tags: ["nature", "art"],
      energy: 0, crowd_level: null, discovery: null, signature: 0.5, physical_demand: null,
      duration_taste_min: null, duration_typical_min: 90, duration_full_min: null,
      best_window: [], crowd_note: null, worth_it_if: [], skip_if: [], local_tip: "Keep this text. ",
      cost_jpy: 500, hours_vary: false, booking_lead_days: 0, conflicts_with: [], pairs_with: [],
      sources: ["first", "second"], seasons: ["koyo", "sakura"],
      verification_status: "draft", verified_by: null, last_verified: null,
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", "kyt-garden");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/places/kyt-garden");
  });
  it.each([
    ["energy", "bad"], ["crowdLevel", "1.1"], ["signature", "Infinity"],
    ["durationTypical", "2.5"], ["bookingLeadDays", "-1"], ["costJpy", "-1"],
    ["name", ""], ["category", ""], ["sources", new Blob(["source"])],
    ["interestTags", new Blob(["nature"])],
  ])("rejects invalid %s before writing", async (field, value) => {
    const form = placeForm();
    form.set(field, value);
    await expect(savePlace(form)).rejects.toThrow("redirect:/admin/places/kyt-garden?error=");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("ignores a missing or malformed id without writing", async () => {
    for (const id of [null, "", "../bad", new Blob(["id"])]) {
      const form = placeForm();
      if (id === null) form.delete("id");
      else form.set("id", id);
      await savePlace(form);
    }
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
