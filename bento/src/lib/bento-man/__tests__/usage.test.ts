import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { runBentoMan, usageFromError } from "../chat";
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

    const err = await runBentoMan({ store, client: billedClient, model: "claude-opus-5", effort: "medium", today: "2026-09-15", message: "hi" }).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("database outage");
    expect(usageFromError(err)["claude-opus-5"]).toMatchObject({ inputTokens: 1200, outputTokens: 300 });
  });
});
