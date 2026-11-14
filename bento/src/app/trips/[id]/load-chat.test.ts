import { describe, expect, it } from "vitest";
import { computeDayDiff } from "@/lib/bento-man/diff";
import { loadChat } from "./load-chat";

const diff = computeDayDiff([{ placeId: "a", name: "A", sortOrder: 0, startMin: 540, locked: true }], {
  date: "2026-11-21", cityId: "kyoto-city", items: [], meals: [], startMin: 540, endMin: 1020,
  budgetMin: 480, activeMin: 0, slackMin: 480, placesJpy: 0, faresJpy: 0, costJpy: 0,
  fareKind: "exact", considered: [], warnings: [],
});

function fakeDb(rows: object[]) {
  const chain = (data: unknown) => {
    const q: Record<string, unknown> = Object.assign(Promise.resolve({ data, error: null }), {});
    for (const k of ["select", "eq", "order", "limit", "in"]) q[k] = () => q;
    return q;
  };
  return { from: (table: string) => chain(table === "chat_messages" ? rows : [{ id: "kyoto-city", name: "Kyoto" }]) } as never;
}

describe("loadChat", () => {
  it("gives the page proposals without the days' base snapshots", async () => {
    expect(diff.base).toHaveLength(1);
    const { messages } = await loadChat(fakeDb([
      { id: "m1", role: "assistant", content: "Plan", proposed_diff: { summary: "Plan", days: [diff] }, diff_status: "proposed", created_at: "2026-11-01" },
    ]), "trip", []);
    expect(messages[0].proposal!.days[0]).toMatchObject({ date: "2026-11-21", cityId: "kyoto-city" });
    expect(messages[0].proposal!.days[0]).not.toHaveProperty("base");
  });
});
