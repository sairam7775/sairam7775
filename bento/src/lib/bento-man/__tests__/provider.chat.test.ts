import { describe, expect, it, vi } from "vitest";
import { runBentoMan, usageFromError } from "../chat";
import { ProviderCallError, type ChatProvider, type ModelResult } from "../provider";
import { MemoryStore } from "../store.memory";
import { ZERO_USAGE } from "../cost";

const result = (overrides: Partial<ModelResult> = {}): ModelResult => ({ text: "Done.", toolCalls: [], stopReason: "end", usage: { ...ZERO_USAGE, inputTokens: 1000, outputTokens: 100 }, model: "claude-opus-5", ...overrides });
const tool = () => result({ text: "Checking dates.", toolCalls: [{ id: "t1", name: "set_trip_dates", input: { start_date: "2026-11-20", end_date: "2026-11-29" } }], stopReason: "tool_use" });
const run = (provider: ChatProvider, options: Partial<Parameters<typeof runBentoMan>[0]> = {}) => runBentoMan({ store: new MemoryStore(), provider, today: "2026-09-15", message: "Set dates", ...options });

describe("chat through a neutral provider", () => {
  it("executes a real tool round, streams prose and accounts for each served model", async () => {
    const first = tool();
    const call = vi.fn<ChatProvider["call"]>()
      .mockImplementationOnce(async (request) => { request.onText?.("Checking dates."); return first; })
      .mockResolvedValueOnce(result({ model: "claude-sonnet-5", usage: { ...ZERO_USAGE, inputTokens: 500, outputTokens: 50 } }));
    const store = new MemoryStore();
    const onText = vi.fn();
    const onTool = vi.fn();
    const settlements: unknown[] = [];
    const hold = vi.fn(async () => ({ settle: async (usage: unknown) => { settlements.push(usage); } }));
    const answer = await run({ model: "claude-opus-5", call }, { store, spend: { hold }, events: { onText, onTool } });
    expect((await store.state()).trip).toMatchObject({ startDate: "2026-11-20", endDate: "2026-11-29" });
    expect(call).toHaveBeenCalledTimes(2);
    const messages = call.mock.calls[1][0].messages;
    expect(messages[0].content).toContain("<trip_state>");
    expect(messages[1]).toEqual({ role: "assistant", content: first.text, toolCalls: first.toolCalls });
    expect(messages[2]).toMatchObject({ role: "user", content: [{ id: "t1", name: "set_trip_dates" }] });
    expect(onText).toHaveBeenCalledWith("Checking dates.");
    expect(onTool.mock.calls).toEqual([["set_trip_dates", "start", true], ["set_trip_dates", "end", true]]);
    expect(answer.text).toBe("Checking dates.\n\nDone.");
    expect(answer.usage).toMatchObject({ inputTokens: 1500, outputTokens: 150 });
    expect(answer.usageByModel["claude-sonnet-5"].inputTokens).toBe(500);
    expect(answer.servedBy).toBe("claude-sonnet-5");
    expect(hold).toHaveBeenCalledTimes(2);
    expect(settlements).toEqual([
      expect.objectContaining({ model: "claude-opus-5", costUsd: 0.0075 }),
      expect.objectContaining({ model: "claude-sonnet-5", costUsd: 0.0015 }),
    ]);
  });

  it("stops politely when the next hold exceeds budget", async () => {
    const call = vi.fn<ChatProvider["call"]>().mockResolvedValue(tool());
    const hold = vi.fn().mockResolvedValueOnce({ settle: vi.fn() }).mockRejectedValueOnce(Object.assign(new Error("cap"), { name: "SpendCapExceeded" }));
    const answer = await run({ model: "claude-opus-5", call }, { spend: { hold } });
    expect(answer.text).toContain("reached this month's Bento Man budget");
    expect(call).toHaveBeenCalledTimes(1);
    expect(answer.usage.inputTokens).toBe(1000);
  });

  it("keeps billed usage from earlier rounds when the provider fails, releasing the failed hold", async () => {
    const failure = new Error("upstream failure");
    const call = vi.fn<ChatProvider["call"]>().mockResolvedValueOnce(tool()).mockRejectedValueOnce(failure);
    const settle = vi.fn(async () => {});
    const error = await run({ model: "claude-opus-5", call }, { spend: { hold: async () => ({ settle }) } }).catch((e) => e);
    expect(error).toBe(failure);
    expect(usageFromError(error)["claude-opus-5"]).toMatchObject({ inputTokens: 1000, outputTokens: 100 });
    expect(settle).toHaveBeenLastCalledWith(null);
  });

  it("settles usage reported on a failed stream and propagates it", async () => {
    const usage = { ...ZERO_USAGE, inputTokens: 100, outputTokens: 10 };
    const call = vi.fn<ChatProvider["call"]>().mockRejectedValue(new ProviderCallError("stream failed", "gemini-2.5-flash", usage));
    const settle = vi.fn(async () => {});
    const error = await run({ model: "gemini-2.5-flash", call }, { spend: { hold: async () => ({ settle }) } }).catch((e) => e);
    expect(usageFromError(error)["gemini-2.5-flash"]).toEqual(usage);
    expect(settle).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-2.5-flash", inputTokens: 100, costUsd: 0 }));
  });

  it.each(["max_tokens", "refusal"] as const)("does not execute tools on %s", async (stopReason) => {
    const call = vi.fn<ChatProvider["call"]>().mockResolvedValue({ ...tool(), stopReason });
    const store = new MemoryStore();
    const answer = await run({ model: "claude-opus-5", call }, { store });
    expect(answer.toolCalls).toEqual([]);
    expect((await store.state()).trip.startDate).toBeNull();
    expect(answer.stopReason).toBe(stopReason);
  });
});
