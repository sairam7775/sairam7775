import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { estimateInputTokens } from "../cost";
import { AnthropicProvider } from "../provider.anthropic";
import { ProviderCallError } from "../provider";
import { TOOLS } from "../tools";
import { SYSTEM_PROMPT } from "../prompt";

describe("AnthropicProvider compatibility", () => {
  it("keeps the original beta request and signed blocks, streaming and fallback usage", async () => {
    const blocks = [
      { type: "thinking", thinking: "considering", signature: "signed" },
      { type: "text", text: " Checking. " },
      { type: "tool_use", id: "t1", name: "get_place", input: { query: "Kyoto" } },
      { type: "text", text: " More. " },
    ];
    const stream = vi.fn(() => ({
      on: (_event: string, callback: (text: string) => void) => callback(" Checking. "),
      finalMessage: async () => ({ model: "claude-sonnet-5", stop_reason: "tool_use", content: blocks, usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 20, cache_read_input_tokens: 100 } }),
    }));
    const client = { beta: { messages: { stream } } } as unknown as Anthropic;
    const provider = new AnthropicProvider(client, "claude-opus-5", "medium");
    const onText = vi.fn();
    const request = { system: SYSTEM_PROMPT, tools: TOOLS, maxOutputTokens: 24000, messages: [{ role: "user" as const, content: "Hello" }], onText };
    const first = await provider.call(request);
    expect(stream).toHaveBeenCalledWith({
      model: "claude-opus-5", max_tokens: 24000,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS, messages: request.messages, output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
    });
    expect(onText).toHaveBeenCalledWith(" Checking. ");
    expect(first.text).toBe("Checking.\n\nMore.");
    expect(first.model).toBe("claude-sonnet-5");
    expect(first.usage).toEqual({ inputTokens: 10, outputTokens: 5, cacheWriteTokens: 20, cacheReadTokens: 100 });
    await provider.call({ ...request, messages: [
      ...request.messages,
      { role: "assistant", content: first.text, toolCalls: first.toolCalls },
      { role: "user", content: [{ id: "t1", name: "get_place", content: "bad input", isError: true }] },
    ] });
    expect(stream).toHaveBeenLastCalledWith(expect.objectContaining({ messages: [
      ...request.messages,
      { role: "assistant", content: blocks },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "bad input", is_error: true }] },
    ] }));
  });

  it("passes the turn's signal to the SDK and reports a call it cut off as timed out, with the usage so far", async () => {
    const turn = new AbortController();
    const stream = vi.fn((_params: unknown, options?: { signal?: AbortSignal }) => ({
      on: () => {},
      currentMessage: { model: "claude-opus-5", usage: { input_tokens: 900, output_tokens: 7, cache_creation_input_tokens: 0, cache_read_input_tokens: 100 } },
      finalMessage: () => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new Error("Request was aborted.")));
        turn.abort(new DOMException("The operation timed out.", "TimeoutError"));
      }),
    }));
    const provider = new AnthropicProvider({ beta: { messages: { stream } } } as unknown as Anthropic, "claude-opus-5", "medium");
    const error = await provider.call({ system: "", tools: [], maxOutputTokens: 100, messages: [{ role: "user", content: "Hi" }], signal: turn.signal }).catch((e) => e);
    expect(stream.mock.calls[0][1]).toEqual({ signal: turn.signal });
    expect(error).toBeInstanceOf(ProviderCallError);
    expect(error.timedOut).toBe(true);
    expect(error.model).toBe("claude-opus-5");
    expect(error.usage).toEqual({ inputTokens: 900, outputTokens: 7, cacheWriteTokens: 0, cacheReadTokens: 100 });
  });

  it("leaves other failures as they were", async () => {
    const boom = new Error("overloaded");
    const stream = vi.fn(() => ({ on: () => {}, finalMessage: async () => { throw boom; } }));
    const provider = new AnthropicProvider({ beta: { messages: { stream } } } as unknown as Anthropic, "claude-opus-5", "medium");
    const error = await provider.call({ system: "", tools: [], maxOutputTokens: 100, messages: [{ role: "user", content: "Hi" }], signal: new AbortController().signal }).catch((e) => e);
    expect(error).toBe(boom);
  });

  it("measures the request it will really send, retained thinking included (Codex review on #54)", async () => {
    const blocks = [
      { type: "thinking", thinking: "x".repeat(30_000), signature: "signed" },
      { type: "tool_use", id: "t1", name: "get_place", input: { query: "Kyoto" } },
    ];
    const stream = vi.fn(() => ({ on: () => {}, finalMessage: async () => ({ model: "claude-opus-5", stop_reason: "tool_use", content: blocks, usage: { input_tokens: 1, output_tokens: 1 } }) }));
    const provider = new AnthropicProvider({ beta: { messages: { stream } } } as unknown as Anthropic, "claude-opus-5", "medium");
    const first = await provider.call({ system: "", tools: [], maxOutputTokens: 100, messages: [{ role: "user", content: "Hi" }] });
    const next = { system: "", tools: [], messages: [
      { role: "user" as const, content: "Hi" },
      { role: "assistant" as const, content: first.text, toolCalls: first.toolCalls },
      { role: "user" as const, content: [{ id: "t1", name: "get_place", content: "{}" }] },
    ] };
    expect(provider.inputTokens(next)).toBeGreaterThanOrEqual(estimateInputTokens(next) + 10_000);
  });
});
