import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), maybeSingle: vi.fn(), aal: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => { throw new Error(`redirect:${path}`); },
  notFound: () => { throw new Error("notFound"); },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser, mfa: { getAuthenticatorAssuranceLevel: mocks.aal } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ service: true }) }));

import { requireAdmin, TWO_FACTOR_PATH } from "./admin";
import { SETTINGS } from "@/app/settings/paths";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: "u1" } });
  mocks.aal.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
});

describe("requireAdmin", () => {
  it("lets an admin through once they have signed in with two-factor", async () => {
    await expect(requireAdmin()).resolves.toMatchObject({ user: { id: "u1" }, db: { service: true } });
  });

  it("sends an admin without a two-factor sign-in to the two-factor page", async () => {
    mocks.aal.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
    await expect(requireAdmin()).rejects.toThrow("redirect:/settings/admin/two-factor");
  });

  it("treats an unreadable assurance level as not two-factor", async () => {
    mocks.aal.mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(requireAdmin()).rejects.toThrow("redirect:/settings/admin/two-factor");
  });

  it("still hides admin pages from someone who isn't an admin", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null });
    await expect(requireAdmin()).rejects.toThrow("notFound");
  });
});


describe("the two-factor page's address", () => {
  it("is the same in the gate and in Settings", () => {
    expect(TWO_FACTOR_PATH).toBe(SETTINGS.twoFactor);
  });
});
