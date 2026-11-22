import type Anthropic from "@anthropic-ai/sdk";
import { estimateInputTokens, type Effort } from "./cost";
import { ProviderCallError, type ChatProvider, type ModelMessage, type ModelRequest, type ModelResult, type ToolCall } from "./provider";

export class AnthropicProvider implements ChatProvider {
  // Keep every original block, including signed thinking and its ordering.
  private readonly assistantBlocks = new WeakMap<ToolCall[], Anthropic.Beta.BetaContentBlock[]>();

  constructor(private readonly client: Anthropic, readonly model: string, private readonly effort: Effort) {}

  private message(message: ModelMessage): Anthropic.Beta.BetaMessageParam {
    if (message.role === "assistant" && message.toolCalls) {
      return {
        role: "assistant",
        content: this.assistantBlocks.get(message.toolCalls) ?? [
          ...(message.content ? [{ type: "text" as const, text: message.content }] : []),
          ...message.toolCalls.map((call) => ({ type: "tool_use" as const, ...call })),
        ],
      };
    }
    if (Array.isArray(message.content)) {
      return { role: "user", content: message.content.map((result) => ({
        type: "tool_result", tool_use_id: result.id, content: result.content, is_error: result.isError || undefined,
      })) };
    }
    return { role: message.role, content: message.content };
  }

  inputTokens(request: Pick<ModelRequest, "system" | "messages" | "tools">): number {
    return estimateInputTokens({ system: request.system, tools: request.tools, messages: request.messages.map((message) => this.message(message)) });
  }

  async call(request: ModelRequest): Promise<ModelResult> {
    // Keep the original beta request, including SDK/server thinking defaults.
    const params: Parameters<Anthropic["beta"]["messages"]["stream"]>[0] = {
      model: this.model,
      max_tokens: request.maxOutputTokens,
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      tools: request.tools,
      messages: request.messages.map((message) => this.message(message)),
      output_config: { effort: this.effort },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    };
    // The SDK's own limit is ten minutes a request: the turn's signal is
    // what keeps a call inside the route's time.
    const stream = request.signal
      ? this.client.beta.messages.stream(params, { signal: request.signal })
      : this.client.beta.messages.stream(params);
    stream.on("text", (delta) => request.onText?.(delta));
    // The response has started: the request reached the model. Before it,
    // the SDK is connecting or waiting to retry, which costs nothing.
    let connected = false;
    stream.on("connect", () => { connected = true; });
    let msg: Anthropic.Beta.BetaMessage;
    try {
      msg = await stream.finalMessage();
    } catch (e) {
      if (!request.signal?.aborted) throw e;
      // Cut off by the turn's deadline. Input is billed once the message
      // started, so what it reported so far rides on the error.
      const partial = stream.currentMessage;
      throw new ProviderCallError("Anthropic call timed out", partial?.model ?? this.model, partial && {
        inputTokens: partial.usage.input_tokens,
        outputTokens: partial.usage.output_tokens,
        cacheWriteTokens: partial.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: partial.usage.cache_read_input_tokens ?? 0,
      }, undefined, true, connected || partial !== undefined);
    }
    const toolCalls = msg.content.flatMap((block) => block.type === "tool_use"
      ? [{ id: block.id, name: block.name, input: block.input }] : []);
    this.assistantBlocks.set(toolCalls, msg.content);
    return {
      text: msg.content.flatMap((block) => block.type === "text" && block.text.trim() ? [block.text.trim()] : []).join("\n\n"),
      toolCalls,
      stopReason: msg.stop_reason === "tool_use" || msg.stop_reason === "max_tokens" || msg.stop_reason === "refusal" ? msg.stop_reason : "end",
      usage: {
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
        cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
      },
      model: msg.model,
    };
  }
}
