import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), maybeSingle: vi.fn(), listFactors: vi.fn(), unenroll: vi.fn(), enroll: vi.fn(), challengeAndVerify: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: mocks.getUser,
      mfa: { listFactors: mocks.listFactors, unenroll: mocks.unenroll, enroll: mocks.enroll, challengeAndVerify: mocks.challengeAndVerify },
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  }),
}));

import { startTwoFactorSetup, verifyTwoFactor } from "../admin/two-factor/actions";

const t = copy.settings.twoFactor;
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  mocks.maybeSingle.mockResolvedValue({ data: { user_id: "u1" } });
  mocks.listFactors.mockResolvedValue({ data: { all: [] }, error: null });
  mocks.unenroll.mockResolvedValue({ error: null });
  mocks.enroll.mockResolvedValue({ data: { id: "f1", type: "totp", totp: { qr_code: "data:image/svg+xml;utf-8,<svg/>", secret: "ABCDEF", uri: "otpauth://x" } }, error: null });
  mocks.challengeAndVerify.mockResolvedValue({ error: null });
});

describe("startTwoFactorSetup", () => {
  it("clears an abandoned setup, then starts a new one and hands back the QR code and key", async () => {
    mocks.listFactors.mockResolvedValue({ data: { all: [{ id: "old", factor_type: "totp", status: "unverified" }] }, error: null });
    const r = await startTwoFactorSetup();
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: "old" });
    expect(mocks.enroll).toHaveBeenCalledWith(expect.objectContaining({ factorType: "totp" }));
    expect(r).toEqual({ step: "verify", factorId: "f1", qr: "data:image/svg+xml;utf-8,<svg/>", secret: "ABCDEF" });
  });

  it("says so when setup can't start", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.enroll.mockResolvedValue({ data: null, error: { message: "MFA disabled" } });
    expect(await startTwoFactorSetup()).toEqual({ step: "start", error: t.setupFailed });
  });

  it("is only for admins", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null });
    await expect(startTwoFactorSetup()).rejects.toThrow("redirect:/settings");
    expect(mocks.enroll).not.toHaveBeenCalled();
  });
});

describe("verifyTwoFactor", () => {
  it("checks the six-digit code and goes on to Admin", async () => {
    await expect(verifyTwoFactor(null, form({ factorId: "f1", code: "123 456" }))).rejects.toThrow("redirect:/settings/admin");
    expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: "f1", code: "123456" });
  });

  it("refuses a code that isn't six digits without asking Supabase", async () => {
    const r = await verifyTwoFactor(null, form({ factorId: "f1", code: "12ab" }));
    expect(r).toMatchObject({ error: t.badCode });
    expect(mocks.challengeAndVerify).not.toHaveBeenCalled();
  });

  it("says the code was wrong, and keeps the setup on screen", async () => {
    mocks.listFactors.mockResolvedValue({ data: { all: [{ id: "f1", factor_type: "totp", status: "unverified" }] }, error: null });
    mocks.challengeAndVerify.mockResolvedValue({ error: { code: "mfa_verification_failed", message: "Invalid TOTP code entered" } });
    const r = await verifyTwoFactor({ step: "verify", factorId: "f1", qr: "q", secret: "s" }, form({ factorId: "f1", code: "123456" }));
    expect(r).toEqual({ step: "verify", factorId: "f1", qr: "q", secret: "s", error: t.wrongCode });
  });

  it("offers to start again when the setup has expired", async () => {
    mocks.challengeAndVerify.mockResolvedValue({ error: { code: "mfa_factor_not_found", message: "Factor not found" } });
    const r = await verifyTwoFactor({ step: "verify", factorId: "f1", qr: "q", secret: "s" }, form({ factorId: "f1", code: "123456" }));
    expect(r).toEqual({ step: "start", error: t.setupExpired });
  });

  it("keeps the setup when the setup can't be looked up either", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listFactors.mockResolvedValue({ data: null, error: { message: "Auth unavailable" } });
    mocks.challengeAndVerify.mockResolvedValue({ error: { code: "unexpected_failure", message: "Auth unavailable" } });
    const r = await verifyTwoFactor({ step: "verify", factorId: "f1", qr: "q", secret: "s" }, form({ factorId: "f1", code: "123456" }));
    expect(r).toEqual({ step: "verify", factorId: "f1", qr: "q", secret: "s", error: t.verifyFailed });
  });

  it("keeps the setup and asks to try again when the check itself failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.listFactors.mockResolvedValue({ data: { all: [{ id: "f1", factor_type: "totp", status: "unverified" }] }, error: null });
    mocks.challengeAndVerify.mockResolvedValue({ error: { code: "over_request_rate_limit", message: "Too many requests" } });
    const r = await verifyTwoFactor({ step: "verify", factorId: "f1", qr: "q", secret: "s" }, form({ factorId: "f1", code: "123456" }));
    expect(r).toEqual({ step: "verify", factorId: "f1", qr: "q", secret: "s", error: t.verifyFailed });
  });
});
