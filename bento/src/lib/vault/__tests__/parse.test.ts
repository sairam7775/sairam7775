/** A failed read is still a billed call: its usage must come back with the
 *  failure so the route can count it against the spend cap. */
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { ParseFailed, parseConfirmation } from "../parse";

function clientReturning(text: string, stop = "end_turn"): Anthropic {
  return {
    messages: {
      create: async () => ({
        model: "claude-haiku-4-5",
        stop_reason: stop,
        content: [{ type: "text", text }],
        usage: { input_tokens: 1200, output_tokens: 300, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
      }),
    },
  } as unknown as Anthropic;
}

describe("parseConfirmation failures carry their cost", () => {
  it.each([
    ["not JSON", "this is not json"],
    ["wrong shape", JSON.stringify({ type: "flight", title: "x".repeat(400) })],
  ])("%s", async (_, reply) => {
    const err = await parseConfirmation(clientReturning(reply), "Booking reference ABC123 on 2026-11-20").catch((e) => e);
    expect(err).toBeInstanceOf(ParseFailed);
    expect(err.usage).toMatchObject({ inputTokens: 1200, outputTokens: 300 });
    expect(err.model).toBe("claude-haiku-4-5");
  });

  it("a refusal is billed too", async () => {
    const err = await parseConfirmation(clientReturning("", "refusal"), "Booking reference ABC123").catch((e) => e);
    expect(err.usage?.inputTokens).toBe(1200);
  });

  it("text too short to send costs nothing and says so", async () => {
    const err = await parseConfirmation(clientReturning("{}"), "hi").catch((e) => e);
    expect(err).toBeInstanceOf(ParseFailed);
    expect(err.usage).toBeNull();
  });
});
