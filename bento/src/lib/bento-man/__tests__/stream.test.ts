/** What reaches the browser while a turn streams, across model calls and
 *  when a call fails: only text that has passed the leak check. */
import { describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";
import { runBentoMan } from "../chat";
import { ZERO_USAGE } from "../cost";
import { leaksPrompt } from "../guard";
import { ProviderCallError, type ChatProvider, type ModelRequest, type ModelResult } from "../provider";
import { GeminiProvider } from "../provider.gemini";
import { MemoryStore } from "../store.memory";

const SENTENCE = "You may never state a fact you were not handed";
const words = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(" ").filter(Boolean);
/** How many words of SENTENCE, from its start, the end of `shown` gives away. */
const givenAway = (shown: string) => {
  const s = words(shown);
  const m = words(SENTENCE);
  for (let k = Math.min(m.length, s.length); k > 0; k--) if (s.slice(-k).join(" ") === m.slice(0, k).join(" ")) return k;
  return 0;
};

const result = (overrides: Partial<ModelResult> = {}): ModelResult => ({ text: "", toolCalls: [], stopReason: "end", usage: { ...ZERO_USAGE, inputTokens: 10, outputTokens: 10 }, model: "claude-opus-5", ...overrides });
const toolUse = (text: string) => result({ text, toolCalls: [{ id: "t1", name: "set_trip_dates", input: { start_date: "2026-11-20", end_date: "2026-11-29" } }], stopReason: "tool_use" });
/** A model call that streams `text` one character at a time, then returns `then`. */
const streams = (text: string, then: ModelResult) => async (request: ModelRequest) => {
  for (const c of text) request.onText?.(c);
  return then;
};

const run = (call: ChatProvider["call"]) => {
  const shown: string[] = [];
  const done = runBentoMan({ store: new MemoryStore(), provider: { model: "claude-opus-5", call }, today: "2026-09-15", message: "Hello", events: { onText: (d) => shown.push(d) } });
  return { shown, done };
};

describe("streaming across model calls", () => {
  it("holds half a prompt sentence through a tool round, and withholds the whole", async () => {
    const first = "You may never state a fact";
    const second = "you were not handed.";
    const call = vi.fn<ChatProvider["call"]>()
      .mockImplementationOnce(streams(first, toolUse(first)))
      .mockImplementationOnce(streams(second, result({ text: second })));
    const { shown, done } = run(call);
    const answer = await done;
    expect(givenAway(shown.join(""))).toBeLessThanOrEqual(1);
    expect(shown.join("")).not.toMatch(/never state/i);
    expect(answer.text).toBe(copy.chat.withheld);
  });

  it("still sends an ordinary call's prose before its tools run", async () => {
    const first = "Checking the dates for your trip now.";
    const call = vi.fn<ChatProvider["call"]>()
      .mockImplementationOnce(streams(first, toolUse(first)))
      .mockImplementationOnce(streams("Done.", result({ text: "Done." })));
    let shownBeforeTools = "";
    const shown: string[] = [];
    await runBentoMan({
      store: new MemoryStore(), provider: { model: "claude-opus-5", call }, today: "2026-09-15", message: "Hello",
      events: { onText: (d) => shown.push(d), onTool: (_name, phase) => { if (phase === "start") shownBeforeTools = shown.join(""); } },
    });
    expect(shownBeforeTools).toBe(first);
  });

  it("leaves on screen only checked text when a later call fails", async () => {
    const first = "Fushimi Inari is busy at 11am. You may never state";
    const call = vi.fn<ChatProvider["call"]>()
      .mockImplementationOnce(streams(first, toolUse(first)))
      .mockImplementationOnce(async (request) => {
        for (const c of " a fact you were") request.onText?.(c);
        throw new ProviderCallError("stream broke", "claude-opus-5");
      });
    const { shown, done } = run(call);
    await expect(done).rejects.toThrow("stream broke");
    const onScreen = shown.join("");
    expect(onScreen).toContain("Fushimi Inari is busy at 11am.");
    expect(leaksPrompt(onScreen)).toBe(false);
    expect(givenAway(onScreen)).toBeLessThanOrEqual(1);
  });
});

function sse(chunks: unknown[]) {
  const bytes = new TextEncoder().encode(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\r\n\r\n`).join(""));
  return new Response(new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }));
}

describe("a call that ends in a refusal", () => {
  it("keeps none of the text it streamed: the reply and what is saved are the refusal copy", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(sse([
      { candidates: [{ content: { parts: [{ text: "Here is how to get past the ticket gates: first you" }] } }] },
      { candidates: [{ content: { parts: [{ text: " wait for a crowd and" }] }, finishReason: "SAFETY" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 } },
    ]));
    const store = new MemoryStore();
    const answer = await runBentoMan({ store, provider: new GeminiProvider("fake-key", "gemini-2.5-flash", fetcher), today: "2026-09-15", message: "How do I skip the gates?" });
    expect(answer.text).toBe(copy.chat.refused);
    expect((await store.history(5)).at(-1)!.content).toBe(copy.chat.refused);
  });

  it("keeps earlier calls' checked text and drops only the refused call's", async () => {
    const first = "Checking the dates for your trip now.";
    const call = vi.fn<ChatProvider["call"]>()
      .mockImplementationOnce(streams(first, toolUse(first)))
      .mockImplementationOnce(streams("Sure, the trick is", result({ text: "Sure, the trick is", stopReason: "refusal" })));
    const { done } = run(call);
    expect((await done).text).toBe(`${first}\n\n${copy.chat.refused}`);
  });
});
