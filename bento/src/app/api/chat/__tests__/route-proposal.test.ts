import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const proposal = {
  summary: "1 day",
  days: [{
    kind: "day", date: "2026-11-21", cityId: "kyoto-city",
    base: [{ placeId: "a", sortOrder: 0, locked: false, startMin: 540, durationMin: 60, arriveMode: null, arriveMinutes: null, arriveDetail: null }],
    after: [], removed: [], summary: "s", considered: [], warnings: [], budgetMin: 480, activeMin: 0, costJpy: 0, fareKind: "exact",
  }],
};

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "user-id" } } }) } }) }));
vi.mock("@/lib/guards/rate-limit", () => ({ rateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/guards/spend", () => ({ reserveSpend: vi.fn(async () => ({ settle: vi.fn() })), SpendCapExceeded: class extends Error {} }));
vi.mock("@/lib/bento-man/store.supabase", () => ({ SupabaseStore: class {} }));
vi.mock("@/lib/bento-man/chat", () => ({
  firstHoldThen: () => ({ hold: vi.fn() }),
  runBentoMan: vi.fn(async () => ({ assistantMessageId: "m1", text: "Here", proposal: structuredClone(proposal) })),
}));
import { POST } from "../route";

afterEach(() => { vi.unstubAllEnvs(); });

describe("chat API done event", () => {
  it("sends the proposal without the days' base snapshots", async () => {
    vi.stubEnv("BENTO_MAN_MOCK", "1");
    const request = new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ tripId: "b8ca68c7-0e71-41b6-9e4c-3c244dc2e135", message: "plan" }) }) as NextRequest;
    const response = await POST(request);
    const events = (await response.text()).split("\n\n").filter(Boolean).map((l) => JSON.parse(l.replace(/^data: /, "")));
    const done = events.find((e) => e.type === "done");
    expect(done.proposal.days[0]).toMatchObject({ date: "2026-11-21", cityId: "kyoto-city" });
    expect(done.proposal.days[0]).not.toHaveProperty("base");
  });
});
