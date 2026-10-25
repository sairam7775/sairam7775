import type Anthropic from "@anthropic-ai/sdk";
import { estimateInputTokens, type Effort } from "./cost";
import type { ChatProvider, ModelMessage, ModelRequest, ModelResult, ToolCall } from "./provider";

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
    const stream = this.client.beta.messages.stream({
      model: this.model,
      max_tokens: request.maxOutputTokens,
      system: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }],
      tools: request.tools,
      messages: request.messages.map((message) => this.message(message)),
      output_config: { effort: this.effort },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    stream.on("text", (delta) => request.onText?.(delta));
    const msg = await stream.finalMessage();
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
