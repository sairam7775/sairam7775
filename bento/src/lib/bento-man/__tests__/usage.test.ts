import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { firstHoldThen, runBentoMan, usageFromError } from "../chat";
import { CHAT_INPUT_BOUND } from "../cost";
import { AnthropicProvider } from "../provider.anthropic";
import { MemoryStore } from "../store.memory";

const prefs = { pace: "standard" as const, interestTags: ["art"] as "art"[], energy: 0.4, crowdTolerance: 0.6, discovery: 0.5, excludes: [] };
const setup = { trip: { startDate: "2026-11-20", endDate: "2026-11-29" }, prefs, cities: [{ cityId: "kyoto-city", nights: 9 }] };

/** A model that answers once, billed, with plain text. */
const billedClient = {
  beta: {
    messages: {
      stream: () => ({
        on: () => {},
        finalMessage: async () => ({
          model: "claude-opus-5",
          stop_reason: "end_turn",
          content: [{ type: "text", text: "Here you go." }],
          usage: { input_tokens: 1200, output_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        }),
      }),
    },
  },
} as unknown as Anthropic;

describe("a billed turn whose reply can't be saved", () => {
  it("still reports what the model cost", async () => {
    const store = new MemoryStore(setup);
    const append = store.append.bind(store);
    store.append = async (role, content, proposal) => {
      if (role === "assistant") throw new Error("database outage");
      return append(role, content, proposal);
    };

    const err = await runBentoMan({ store, provider: new AnthropicProvider(billedClient, "claude-opus-5", "medium"), today: "2026-09-15", message: "hi" }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("database outage");
    expect(usageFromError(err)["claude-opus-5"]).toMatchObject({ inputTokens: 1200, outputTokens: 300 });
  });
});

/** A model that asks for a tool on its first `rounds - 1` answers, then finishes. */
function toolThenDone(rounds: number): Anthropic {
  let n = 0;
  return {
    beta: {
      messages: {
        stream: () => ({
          on: () => {},
          finalMessage: async () => {
            n++;
            const more = n < rounds;
            return {
              model: "claude-opus-5",
              stop_reason: more ? "tool_use" : "end_turn",
              content: more ? [{ type: "tool_use", id: `t${n}`, name: "no_such_tool", input: {} }] : [{ type: "text", text: "Done." }],
              usage: { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
            };
          },
        }),
      },
    },
  } as unknown as Anthropic;
}

const run = (client: Anthropic, spend: NonNullable<Parameters<typeof runBentoMan>[0]["spend"]>) =>
  runBentoMan({ store: new MemoryStore(setup), provider: new AnthropicProvider(client, "claude-opus-5", "medium"), today: "2026-09-15", message: "hi", spend });

describe("spend holds", () => {
  it("each model call takes its own hold and settles it with that call's cost", async () => {
    const settled: unknown[] = [];
    let holds = 0;
    const spend = { hold: async () => { holds++; return { settle: async (u: unknown) => { settled.push(u); } }; } };
    await run(toolThenDone(3), spend);
    expect(holds).toBe(3);
    expect(settled).toHaveLength(3);
    expect(settled[0]).toMatchObject({ model: "claude-opus-5", inputTokens: 1000, outputTokens: 100 });
  });

  it("stops between tool rounds when the budget runs out, and says so", async () => {
    let holds = 0;
    const spend = {
      hold: async () => {
        if (++holds > 2) throw Object.assign(new Error("cap"), { name: "SpendCapExceeded" });
        return { settle: async () => {} };
      },
    };
    const r = await run(toolThenDone(5), spend);
    expect(holds).toBe(3);
    expect(r.text).toMatch(/budget/);
  });

  it("an exhausted budget before the first call is the caller's to report", async () => {
    const spend = { hold: async () => { throw Object.assign(new Error("cap"), { name: "SpendCapExceeded" }); } };
    await expect(run(toolThenDone(2), spend)).rejects.toThrow("cap");
  });

  it("a call that fails settles its hold with nothing", async () => {
    const settled: unknown[] = [];
    const client = { beta: { messages: { stream: () => ({ on: () => {}, finalMessage: async () => { throw new Error("overloaded"); } }) } } } as unknown as Anthropic;
    await expect(run(client, { hold: async () => ({ settle: async (u) => { settled.push(u); } }) })).rejects.toThrow("overloaded");
    expect(settled).toEqual([null]);
  });
});

describe("hold sizes (Codex review on #3)", () => {
  it("sizes each hold to the request it is for, which grows with tool results", async () => {
    const asked: number[] = [];
    const spend = { hold: async (input: number) => { asked.push(input); return { settle: async () => {} }; } };
    await run(toolThenDone(3), spend);
    expect(asked).toHaveLength(3);
    expect(asked[0]).toBeGreaterThan(0);
    expect(asked[2]).toBeGreaterThan(asked[0]);
  });

  const holdOf = (name: string, log: string[]) => ({ settle: async (u: unknown) => { log.push(`${name} ${u === null ? "given back" : "used"}`); } });

  it("uses the route's first hold for a first request within the usual ceiling", async () => {
    const log: string[] = [];
    const taken: number[] = [];
    const holds = firstHoldThen(holdOf("first", log), async (n) => { taken.push(n); return holdOf("new", log); });
    await holds.hold(1_000);
    expect(taken).toEqual([]);
    await holds.hold(2_000);
    expect(taken).toEqual([2_000]);
    expect(log).toEqual([]);
  });

  it("gives the first hold back and takes one its size when the first request is bigger", async () => {
    const log: string[] = [];
    const taken: number[] = [];
    const holds = firstHoldThen(holdOf("first", log), async (n) => { taken.push(n); return holdOf("new", log); });
    await holds.hold(CHAT_INPUT_BOUND + 1);
    expect(log).toEqual(["first given back"]);
    expect(taken).toEqual([CHAT_INPUT_BOUND + 1]);
  });
});

describe("hold sizes from the provider (Codex review on #54)", () => {
  it("sizes holds from the provider's own measure of its request when it has one", async () => {
    const asked: number[] = [];
    const provider = {
      model: "claude-opus-5",
      call: async () => ({ text: "Hi.", toolCalls: [], stopReason: "end" as const, usage: { inputTokens: 10, outputTokens: 2, cacheWriteTokens: 0, cacheReadTokens: 0 }, model: "claude-opus-5" }),
      inputTokens: () => 123_456,
    };
    await runBentoMan({ store: new MemoryStore(setup), provider, today: "2026-09-15", message: "hi", spend: { hold: async (n: number) => { asked.push(n); return { settle: async () => {} }; } } });
    expect(asked).toEqual([123_456]);
  });
});
