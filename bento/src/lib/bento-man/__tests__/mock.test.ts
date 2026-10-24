/** Mock mode: the real chat loop and the real tools, with the model
 *  replaced by a keyword script. What must hold is that a mocked turn
 *  still goes through the engine and still costs nothing. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { runBentoMan } from "../chat";
import { AnthropicProvider } from "../provider.anthropic";
import { createMockClient, mockModeEnabled, mockParse, pickTool } from "../mock";
import { MemoryStore } from "../store.memory";
import { ParsedBookingSchema, parseConfirmation } from "@/lib/vault/parse";

const nov = { startDate: "2026-11-20", endDate: "2026-11-29" };

function turn(store: MemoryStore, message: string) {
  return runBentoMan({ store, provider: new AnthropicProvider(createMockClient(), "mock", "medium"), today: "2026-09-15", message, persist: false });
}

describe("mockModeEnabled", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("is on only when asked for, and never in production", () => {
    vi.stubEnv("BENTO_MAN_MOCK", "");
    expect(mockModeEnabled()).toBe(false);
    vi.stubEnv("BENTO_MAN_MOCK", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(mockModeEnabled()).toBe(true);
    vi.stubEnv("NODE_ENV", "production");
    expect(mockModeEnabled()).toBe(false);
  });
});

describe("pickTool", () => {
  it("maps the documented phrasings to tools", () => {
    expect(pickTool("dates 2026-11-20 to 2026-11-29")).toEqual({ name: "set_trip_dates", input: { start_date: "2026-11-20", end_date: "2026-11-29" } });
    expect(pickTool("start later on 2026-11-21 at 9:30")?.input).toEqual({ date: "2026-11-21", ops: [{ op: "start_at", time: "09:30" }] });
    expect(pickTool("I like a relaxed pace")?.input).toMatchObject({ pace: "relaxed" });
    expect(pickTool("suggest a route")?.name).toBe("suggest_route");
    expect(pickTool("plan my days")?.name).toBe("plan_days");
    expect(pickTool("tell me about Fushimi Inari")).toEqual({ name: "get_place", input: { query: "Fushimi Inari" } });
    expect(pickTool("What's the history of Kiyomizu-dera?")).toEqual({ name: "place_background", input: { query: "Kiyomizu-dera" } });
    expect(pickTool("what is the story behind Kinkaku-ji")).toEqual({ name: "place_background", input: { query: "Kinkaku-ji" } });
    expect(pickTool("hello")).toBeNull();
  });
});

describe("a mocked turn", () => {
  it("answers anything it doesn't understand with the help text, for free", async () => {
    const r = await turn(new MemoryStore(), "hello");
    expect(r.text).toContain("Mock mode");
    expect(r.proposal).toBeNull();
    expect(r.usage).toEqual({ inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 });
  });

  it("sets dates through the real tool", async () => {
    const store = new MemoryStore();
    const r = await turn(store, "dates 2026-11-20 to 2026-11-29");
    expect(r.toolCalls).toEqual([expect.objectContaining({ name: "set_trip_dates", ok: true })]);
    expect((await store.state()).trip).toMatchObject(nov);
  });

  it("chains suggest_route into a real route proposal", async () => {
    const r = await turn(new MemoryStore({ trip: nov }), "suggest a route");
    expect(r.toolCalls.map((c) => c.name)).toEqual(["suggest_route", "propose_route"]);
    expect(r.toolCalls.every((c) => c.ok)).toBe(true);
    expect(r.proposal).not.toBeNull();
  });

  it("passes a tool's refusal through rather than inventing a plan", async () => {
    const r = await turn(new MemoryStore(), "suggest a route");
    expect(r.toolCalls).toEqual([expect.objectContaining({ name: "suggest_route", ok: false })]);
    expect(r.text).toContain("no dates");
    expect(r.proposal).toBeNull();
  });
});

describe("mock parse", () => {
  it("returns JSON the real parser accepts", async () => {
    const text = "Hotel Kanra Kyoto\nBooking reference: HK12345\nCheck-in 2026-11-20 15:00, check-out 2026-11-23 11:00\nTotal JPY 84,000";
    const parsed = ParsedBookingSchema.parse(JSON.parse(mockParse(text)));
    expect(parsed).toMatchObject({ type: "accommodation", reference: "HK12345", starts_on: "2026-11-20", ends_on: "2026-11-23", cost_amount: 84000, cost_currency: "JPY" });

    const r = await parseConfirmation(createMockClient(), text);
    expect(r.booking.title).toBe("Hotel Kanra Kyoto");
    expect(r.usage.inputTokens).toBe(0);
  });
});
