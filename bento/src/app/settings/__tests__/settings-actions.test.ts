import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), updateUser: vi.fn(), signInWithPassword: vi.fn(), maybeSingle: vi.fn(),
  requireAdmin: vi.fn(), cookieGet: vi.fn(), cookieDelete: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete, set: vi.fn() }),
  headers: async () => new Headers(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser, updateUser: mocks.updateUser, signInWithPassword: mocks.signInWithPassword },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/account/delete", () => ({ deleteAccountData: vi.fn(), postHogDeleter: vi.fn() }));
vi.mock("@/lib/admin", () => ({ requireAdmin: mocks.requireAdmin }));

import { setDisplayName } from "../actions";
import { addAdmin } from "../admin-actions";
import { deleteAccount, updatePassword } from "../../(auth)/actions";

const USER = { id: "u1", email: "sai@example.com", app_metadata: { providers: ["email"] }, identities: [{ provider: "email" }] };
const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: USER } });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.maybeSingle.mockResolvedValue({ data: null });
});

describe("Settings → Personal information → name", () => {
  it("says saved once the name is stored", async () => {
    await expect(setDisplayName(null, form({ name: "Sai" }))).resolves.toBe("saved");
  });

  it("says it failed when storing it fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateUser.mockResolvedValue({ error: { message: "down" } });
    await expect(setDisplayName(null, form({ name: "Sai" }))).resolves.toBe("failed");
  });

  it("sends a signed-out visitor to sign in, then back to the page", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    await expect(setDisplayName(null, form({ name: "Sai" }))).rejects.toThrow("redirect:/sign-in?next=/settings/personal");
  });
});

describe("where Settings actions return to", () => {
  it("a changed password lands on Personal information", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    await expect(updatePassword(form({ current: "old-password", password: "new-password", confirm: "new-password" })))
      .rejects.toThrow("redirect:/settings/personal?updated=password");
  });

  it("a refused account deletion goes back to the delete page", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { status: 400 } });
    const expected = `redirect:/settings/delete?${new URLSearchParams({ error: copy.auth.errors.wrongCurrent })}`;
    await expect(deleteAccount(form({ password: "wrong-password" }))).rejects.toThrow(expected);
  });

  it("an admin change goes back to the Admin page", async () => {
    mocks.requireAdmin.mockResolvedValue({ user: { id: "u1" }, db: {} });
    await expect(addAdmin(form({ email: "not-an-email" }))).rejects.toThrow("redirect:/settings/admin?adminError=badEmail");
  });
});
