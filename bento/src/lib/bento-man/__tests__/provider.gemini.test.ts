import { describe, expect, it, vi } from "vitest";
import { estimateInputTokens } from "../cost";
import { GeminiProvider } from "../provider.gemini";
import { ProviderCallError, type ModelRequest } from "../provider";
import { TOOLS } from "../tools";

const request: ModelRequest = { system: "Be factual.", messages: [{ role: "user", content: "Hello" }], tools: TOOLS, maxOutputTokens: 24000 };

function sse(chunks: unknown[], fragmented = false) {
  const bytes = new TextEncoder().encode(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\r\n\r\n`).join(""));
  return new Response(new ReadableStream({
    start(controller) {
      if (fragmented) for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
      else controller.enqueue(bytes);
      controller.close();
    },
  }));
}

describe("GeminiProvider", () => {
  it("streams text across byte boundaries and maps cumulative usage, cached input, tool-use input and thinking", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(sse([
      { candidates: [{ content: { parts: [{ text: "private thought", thought: true }, { text: "Kyoto 京都" }] } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 2 } },
      { candidates: [{ content: { parts: [{ text: " is here." }] }, finishReason: "STOP" }], modelVersion: "gemini-2.5-flash", usageMetadata: { cachedContentTokenCount: 20, toolUsePromptTokenCount: 5, candidatesTokenCount: 8, thoughtsTokenCount: 4 } },
    ], true));
    const onText = vi.fn();
    const result = await new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher).call({ ...request, onText });
    expect(result).toEqual({ text: "Kyoto 京都 is here.", toolCalls: [], stopReason: "end", model: "gemini-2.5-flash", usage: { inputTokens: 85, outputTokens: 12, cacheReadTokens: 20, cacheWriteTokens: 0 } });
    expect(onText.mock.calls).toEqual([["Kyoto 京都"], [" is here."]]);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain(":streamGenerateContent?alt=sse");
    expect(url).not.toContain("fake-key");
    expect(options?.headers).toMatchObject({ "x-goog-api-key": "fake-key" });
    const body = JSON.parse(options?.body as string);
    expect(body.systemInstruction).toEqual({ parts: [{ text: request.system }] });
    expect(body.generationConfig).toEqual({ maxOutputTokens: 24000, candidateCount: 1 });
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "Hello" }] }]);
    const preferences = body.tools[0].functionDeclarations[0];
    expect(preferences.name).toBe("set_preferences");
    expect(preferences.parameters.type).toBe("OBJECT");
    expect(preferences.parameters.additionalProperties).toBeUndefined();
    expect(preferences.parameters.properties.energy).toEqual({ type: "NUMBER", minimum: 0, maximum: 1 });
    expect(preferences.parameters.properties.interest_tags.items.type).toBe("STRING");
  });

  it("maps parallel function calls and round-trips thought signatures, names, IDs and tool errors", async () => {
    const parts = [
      { functionCall: { id: "server-id", name: "get_place", args: { query: "Kyoto" } }, thoughtSignature: "signed" },
      { functionCall: { name: "get_place", args: { query: "Osaka" } } },
    ];
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(sse([{ candidates: [{ content: { parts }, finishReason: "STOP" }] }]))
      .mockResolvedValueOnce(sse([{ candidates: [{ content: { parts: [{ text: "Done" }] }, finishReason: "STOP" }] }]));
    const provider = new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher);
    const first = await provider.call(request);
    expect(first.stopReason).toBe("tool_use");
    expect(first.toolCalls).toEqual([
      { id: "server-id", name: "get_place", input: { query: "Kyoto" } },
      { id: expect.any(String), name: "get_place", input: { query: "Osaka" } },
    ]);
    await provider.call({ ...request, messages: [
      ...request.messages,
      { role: "assistant", content: first.text, toolCalls: first.toolCalls },
      { role: "user", content: first.toolCalls.map((call, i) => ({ id: call.id, name: call.name, content: i ? "not found" : '{"name":"Kyoto"}', isError: !!i })) },
    ] });
    const body = JSON.parse(fetcher.mock.calls[1][1]?.body as string);
    expect(body.contents[1]).toEqual({ role: "model", parts });
    expect(body.contents[2].parts).toEqual([
      { functionResponse: { id: "server-id", name: "get_place", response: { output: '{"name":"Kyoto"}' } } },
      { functionResponse: { name: "get_place", response: { error: "not found" } } },
    ]);
  });

  it("maps MAX_TOKENS even when the candidate contains a tool call", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(sse([{ candidates: [{ content: { parts: [{ functionCall: { name: "set_trip_dates", args: {} } }] }, finishReason: "MAX_TOKENS" }] }]));
    expect((await new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher).call(request)).stopReason).toBe("max_tokens");
  });

  it.each(["SAFETY", "RECITATION", "SPII"])("maps %s to refusal", async (finishReason) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(sse([{ candidates: [{ finishReason }] }]));
    expect((await new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher).call(request)).stopReason).toBe("refusal");
  });

  it("maps blocked prompts without a candidate to refusal", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(sse([{ promptFeedback: { blockReason: "SAFETY" } }]));
    expect((await new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher).call(request)).stopReason).toBe("refusal");
  });

  it("reports API errors with status without echoing upstream content", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('{"error":{"message":"private prompt"}}', { status: 429 }));
    const wait = vi.fn(async () => {});
    const error = await new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher, wait, []).call(request).catch((e) => e);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(ProviderCallError);
    expect(error.status).toBe(429);
    expect(error.message).toBe("Gemini API error (429)");
    expect(error.usage).toBeUndefined();
  });

  it("retries overload before anything streams, then succeeds", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(sse([{ candidates: [{ content: { parts: [{ text: "Hi." }] }, finishReason: "STOP" }] }]));
    const wait = vi.fn(async () => {});
    const result = await new GeminiProvider("fake-key", "gemini-3.8-flash", fetcher, wait).call(request);
    expect(result.text).toBe("Hi.");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[1_000], [3_000]]);
  });

  it("moves to the next model when one is out of quota, and skips it on the next call", async () => {
    const urls: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      urls.push(String(url).split("/models/")[1].split(":")[0]);
      return String(url).includes("gemini-3.8-flash")
        ? new Response("{}", { status: 429 })
        : sse([{ candidates: [{ content: { parts: [{ text: "Hi." }] }, finishReason: "STOP" }], modelVersion: "gemini-3.6-flash" }]);
    });
    const provider = new GeminiProvider("fake-key", "gemini-3.8-flash", fetcher, vi.fn(async () => {}), ["gemini-3.6-flash", "gemini-3.1-flash-lite"]);
    expect((await provider.call(request)).model).toBe("gemini-3.6-flash");
    await provider.call(request);
    expect(urls).toEqual(["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.6-flash"]);
  });

  it("moves on after overload outlasts the retries", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) =>
      String(url).includes("gemini-3.8-flash")
        ? new Response("{}", { status: 503 })
        : sse([{ candidates: [{ content: { parts: [{ text: "Hi." }] }, finishReason: "STOP" }] }]),
    );
    const result = await new GeminiProvider("fake-key", "gemini-3.8-flash", fetcher, vi.fn(async () => {}), ["gemini-3.6-flash"]).call(request);
    expect(result.model).toBe("gemini-3.6-flash");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("tries a model that stayed overloaded last on the turn's later calls", async () => {
    const urls: string[] = [];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      urls.push(String(url).split("/models/")[1].split(":")[0]);
      return String(url).includes("gemini-3.8-flash")
        ? new Response("{}", { status: 503 })
        : sse([{ candidates: [{ content: { parts: [{ text: "Hi." }] }, finishReason: "STOP" }] }]);
    });
    const provider = new GeminiProvider("fake-key", "gemini-3.8-flash", fetcher, vi.fn(async () => {}), ["gemini-3.6-flash"]);
    await provider.call(request);
    await provider.call(request);
    expect(urls).toEqual(["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.6-flash"]);
  });

  it("still tries overloaded models when every model has been overloaded", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}", { status: 503 }));
    const provider = new GeminiProvider("fake-key", "gemini-3.8-flash", fetcher, vi.fn(async () => {}), ["gemini-3.6-flash"]);
    expect((await provider.call(request).catch((e) => e)).status).toBe(503);
    expect((await provider.call(request).catch((e) => e)).status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(12);
  });

  it("reports the last status when every model in the chain is out of quota", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}", { status: 429 }));
    const provider = new GeminiProvider("fake-key", "gemini-3.8-flash", fetcher, vi.fn(async () => {}), ["gemini-3.6-flash"]);
    expect((await provider.call(request).catch((e) => e)).status).toBe(429);
    expect((await provider.call(request).catch((e) => e)).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("marks a call that hit its time limit as timed out", async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    const error = await new GeminiProvider("fake-key", "gemini-3.8-flash", fetcher, vi.fn(async () => {}), []).call(request).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderCallError);
    expect(error.timedOut).toBe(true);
  });

  it("does not retry a request error", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response("{}", { status: 400 }));
    const wait = vi.fn(async () => {});
    const error = await new GeminiProvider("fake-key", "gemini-3.8-flash", fetcher, wait).call(request).catch((e) => e);
    expect(error.status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("rejects incomplete streams and keeps reported usage", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(sse([{ candidates: [{ content: { parts: [{ text: "Partial" }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3 } }]));
    const error = await new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher).call(request).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderCallError);
    expect(error.usage).toMatchObject({ inputTokens: 10, outputTokens: 3 });
  });

  it("rejects malformed function calls even when function-call parts are present", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(sse([{ candidates: [{ content: { parts: [{ functionCall: { name: "set_trip_dates", args: {} } }] }, finishReason: "MALFORMED_FUNCTION_CALL" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3 } }]));
    const error = await new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher).call(request).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderCallError);
    expect(error.message).toContain("MALFORMED_FUNCTION_CALL");
    expect(error.usage).toMatchObject({ inputTokens: 10, outputTokens: 3 });
  });

  it("measures the request it will really send, thought signatures included (Codex review on #54)", async () => {
    const parts = [{ functionCall: { id: "c1", name: "get_place", args: { query: "Kyoto" } }, thoughtSignature: "s".repeat(30_000) }];
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(sse([{ candidates: [{ content: { parts }, finishReason: "STOP" }] }]));
    const provider = new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher);
    const first = await provider.call(request);
    const next = { system: request.system, tools: request.tools, messages: [
      ...request.messages,
      { role: "assistant" as const, content: first.text, toolCalls: first.toolCalls },
      { role: "user" as const, content: [{ id: "c1", name: "get_place", content: "{}" }] },
    ] };
    expect(provider.inputTokens(next)).toBeGreaterThanOrEqual(estimateInputTokens(next) + 10_000);
  });
});
