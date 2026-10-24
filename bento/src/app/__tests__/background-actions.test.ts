import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), upsert: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(),
  revalidatePath: vi.fn(), requireAdmin: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.requireAdmin }));

import { approveBackground, saveBackground } from "../admin/background-actions";

const OK = "Built in 1397 as a retirement villa for the shogun Ashikaga Yoshimitsu, it became a Zen temple after his death. A monk burned it down in 1950; what stands now is the 1955 rebuild.";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue({ upsert: mocks.upsert, update: mocks.update });
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.eq, select: mocks.select });
  mocks.select.mockResolvedValue({ data: [{ place_id: "kyt-kinkakuji" }], error: null });
  mocks.requireAdmin.mockResolvedValue({ user: { id: "u1", email: "owner@example.com" }, db: { from: mocks.from } });
});

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("saveBackground", () => {
  it("refuses a background with an opening time", async () => {
    await expect(saveBackground(form({ placeId: "kyt-kinkakuji", body: `${OK} Open 9:00.`, sources: "shokoku-ji.jp" })))
      .rejects.toThrow(/redirect:\/admin\/backgrounds\?error=/);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("refuses a background with no source", async () => {
    await expect(saveBackground(form({ placeId: "kyt-kinkakuji", body: OK, sources: " , " }))).rejects.toThrow(/error=/);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("saving sends a checked background back to draft", async () => {
    await expect(saveBackground(form({ placeId: "kyt-kinkakuji", body: OK, sources: "shokoku-ji.jp, city.kyoto.lg.jp" }))).rejects.toThrow(/redirect:\/admin\/backgrounds\?saved=/);
    expect(mocks.from).toHaveBeenCalledWith("place_backgrounds");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ place_id: "kyt-kinkakuji", body: OK, sources: ["shokoku-ji.jp", "city.kyoto.lg.jp"], status: "draft", verified_by: null, verified_on: null, drafted_by: "owner@example.com" }),
      { onConflict: "place_id" },
    );
  });
});

describe("approveBackground", () => {
  const SEEN = "2026-10-23T10:00:00.123456+00:00";

  it("approves only the draft the admin was shown, signed by them", async () => {
    await expect(approveBackground(form({ placeId: "kyt-kinkakuji", seen: SEEN }))).rejects.toThrow(/redirect:\/admin\/backgrounds\?approved=/);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: "verified", verified_by: "owner@example.com" }));
    expect(mocks.eq).toHaveBeenCalledWith("place_id", "kyt-kinkakuji");
    expect(mocks.eq).toHaveBeenCalledWith("status", "draft");
    expect(mocks.eq).toHaveBeenCalledWith("updated_at", SEEN);
  });

  it("refuses an approval that doesn't say which text was shown", async () => {
    await expect(approveBackground(form({ placeId: "kyt-kinkakuji" }))).rejects.toThrow(/error=/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("says so when the draft changed or was approved since it was shown", async () => {
    mocks.select.mockResolvedValue({ data: [], error: null });
    await expect(approveBackground(form({ placeId: "kyt-kinkakuji", seen: SEEN }))).rejects.toThrow(/error=.*changed/);
  });
});
