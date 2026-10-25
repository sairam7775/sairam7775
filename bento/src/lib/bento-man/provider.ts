/** One model call. The chat loop owns tools, persistence and spend holds. */
import type { Usage } from "./cost";

export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResult {
  id: string;
  name: string;
  content: string;
  isError?: boolean;
}

export type ModelMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: ToolCall[] }
  | { role: "user"; content: ToolResult[] };

export interface ModelTool {
  name: string;
  description: string;
  input_schema: { type: "object"; [key: string]: unknown };
}

export interface ModelRequest {
  system: string;
  messages: ModelMessage[];
  tools: ModelTool[];
  maxOutputTokens: number;
  onText?: (delta: string) => void;
}

export interface ModelResult {
  text: string;
  toolCalls: ToolCall[];
  stopReason: "end" | "tool_use" | "max_tokens" | "refusal";
  usage: Usage;
  model: string;
}

export interface ChatProvider {
  readonly model: string;
  /** Pass returned toolCalls back unchanged in the next assistant message.
   *  Providers can retain signed thinking blocks privately against that array. */
  call(request: ModelRequest): Promise<ModelResult>;
  /** The request's input tokens as this provider will really send it,
   *  retained thinking and signatures included. The chat loop sizes each
   *  spend hold from it; without it, from the neutral messages. */
  inputTokens?(request: Pick<ModelRequest, "system" | "messages" | "tools">): number;
}

/** A failed stream may already have reported billable usage. */
export class ProviderCallError extends Error {
  /** `timedOut`: the call hit its time limit, so the turn can say "took too long". */
  constructor(message: string, readonly model: string, readonly usage?: Usage, readonly status?: number, readonly timedOut = false) {
    super(message);
    this.name = "ProviderCallError";
  }
}

export type ProviderName = "anthropic" | "gemini";

export function configuredProvider(): ProviderName {
  const name = process.env.BENTO_MAN_PROVIDER?.trim() || "anthropic";
  if (name !== "anthropic" && name !== "gemini") throw new Error(`Unknown BENTO_MAN_PROVIDER: ${name}`);
  return name;
}

export function providerKeyVariable(provider: ProviderName): "ANTHROPIC_API_KEY" | "GEMINI_API_KEY" {
  return provider === "gemini" ? "GEMINI_API_KEY" : "ANTHROPIC_API_KEY";
}
