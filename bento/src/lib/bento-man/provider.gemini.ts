/** Gemini Developer API, streamed with REST/SSE; no SDK dependency.
 *  https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent */
import { DEFAULT_GEMINI_MODEL, ZERO_USAGE, type Usage } from "./cost";
import { ProviderCallError, type ChatProvider, type ModelMessage, type ModelRequest, type ModelResult, type ToolCall } from "./provider";

type Part = {
  text?: string;
  thought?: boolean;
  thoughtSignature?: string;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
};
type Chunk = {
  candidates?: { index?: number; content?: { parts?: Part[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  modelVersion?: string;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number; cachedContentTokenCount?: number };
  error?: { code?: number; message?: string };
};

/** Our tool schemas use JSON Schema. Gemini's `parameters` uses a subset
 *  of OpenAPI Schema; Zod still enforces all constraints when tools run. */
export function geminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ["description", "enum", "required", "format", "minimum", "maximum", "minItems", "maxItems", "nullable"]) {
    if (schema[key] !== undefined) out[key] = schema[key];
  }
  if (typeof schema.type === "string") out.type = schema.type.toUpperCase();
  if (schema.properties && typeof schema.properties === "object") {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([name, value]) => [name, geminiSchema(value as Record<string, unknown>)]));
  }
  if (schema.items && typeof schema.items === "object") out.items = geminiSchema(schema.items as Record<string, unknown>);
  return out;
}

/** Handles arbitrary network boundaries, CRLF and multiline SSE data. */
async function* events(body: ReadableStream<Uint8Array>): AsyncGenerator<Chunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let data: string[] = [];
  const parse = () => {
    const value = data.join("\n");
    data = [];
    return value && value !== "[DONE]" ? JSON.parse(value) as Chunk : undefined;
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      if (done && pending && !pending.endsWith("\n")) pending += "\n";
      let end: number;
      while ((end = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, end).replace(/\r$/, "");
        pending = pending.slice(end + 1);
        if (!line) {
          const chunk = parse();
          if (chunk) yield chunk;
        } else if (line.startsWith("data:")) {
          data.push(line.slice(5).replace(/^ /, ""));
        }
      }
      if (done) {
        const chunk = parse();
        if (chunk) yield chunk;
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function usageFromMetadata(metadata: NonNullable<Chunk["usageMetadata"]>): Usage {
  const cacheReadTokens = metadata.cachedContentTokenCount ?? 0;
  return {
    // Gemini promptTokenCount includes cached input; neutral input is uncached.
    inputTokens: Math.max(0, (metadata.promptTokenCount ?? 0) - cacheReadTokens),
    outputTokens: (metadata.candidatesTokenCount ?? 0) + (metadata.thoughtsTokenCount ?? 0),
    cacheWriteTokens: 0,
    cacheReadTokens,
  };
}

const REFUSALS = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT", "IMAGE_RECITATION", "ESCALATION", "PUP_LIMITED_DISABLED"]);

export class GeminiProvider implements ChatProvider {
  private readonly assistantParts = new WeakMap<ToolCall[], Part[]>();
  private sequence = 0;
  private readonly responseIds = new Set<string>();
  readonly model: string;

  constructor(
    private readonly apiKey = process.env.GEMINI_API_KEY ?? "",
    model = process.env.BENTO_MAN_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.model = model.replace(/^models\//, "");
  }

  private content(message: ModelMessage) {
    if (message.role === "assistant") {
      return { role: "model", parts: (message.toolCalls && this.assistantParts.get(message.toolCalls)) ?? [
        ...(message.content ? [{ text: message.content }] : []),
        ...(message.toolCalls ?? []).map((call) => ({ functionCall: { id: call.id, name: call.name, args: call.input } })),
      ] };
    }
    if (Array.isArray(message.content)) {
      return { role: "user", parts: message.content.map((result) => ({
        functionResponse: {
          ...(this.responseIds.has(result.id) ? { id: result.id } : {}),
          name: result.name,
          response: { [result.isError ? "error" : "output"]: result.content },
        },
      })) };
    }
    return { role: "user", parts: [{ text: message.content }] };
  }

  async call(request: ModelRequest): Promise<ModelResult> {
    if (!this.apiKey) throw new ProviderCallError("GEMINI_API_KEY is not set", this.model);
    let model = this.model;
    let usage: Usage | undefined;
    let metadata: Chunk["usageMetadata"];
    const parts: Part[] = [];
    const texts: string[] = [];
    const toolCalls: ToolCall[] = [];
    let finish: string | undefined;
    try {
      const response = await this.fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
          signal: AbortSignal.timeout(110_000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system }] },
            contents: request.messages.map((message) => this.content(message)),
            ...(request.tools.length ? { tools: [{ functionDeclarations: request.tools.map((tool) => ({
              name: tool.name, description: tool.description, parameters: geminiSchema(tool.input_schema),
            })) }] } : {}),
            generationConfig: { maxOutputTokens: request.maxOutputTokens, candidateCount: 1 },
          }),
        },
      );
      // Don't include upstream bodies in errors: they may echo prompts or keys.
      if (!response.ok) {
        await response.body?.cancel();
        throw new ProviderCallError(`Gemini API error (${response.status})`, model, undefined, response.status);
      }
      if (!response.body) throw new Error("Gemini returned no stream");
      for await (const chunk of events(response.body)) {
        if (chunk.modelVersion) model = chunk.modelVersion;
        // Streaming usage is cumulative, so replace it rather than summing.
        if (chunk.usageMetadata) {
          metadata = { ...metadata, ...chunk.usageMetadata };
          usage = usageFromMetadata(metadata);
        }
        if (chunk.error) throw new ProviderCallError("Gemini stream error", model, usage, chunk.error.code);
        if (chunk.promptFeedback?.blockReason) finish = "SAFETY";
        const candidate = chunk.candidates?.find((candidate) => (candidate.index ?? 0) === 0);
        if (candidate?.finishReason) finish = candidate.finishReason;
        for (const part of candidate?.content?.parts ?? []) {
          parts.push(part); // Preserve thought signatures for the next tool round.
          if (part.text && !part.thought) {
            texts.push(part.text);
            request.onText?.(part.text);
          }
          if (part.functionCall) {
            const call = part.functionCall;
            if (call.id) this.responseIds.add(call.id);
            toolCalls.push({ id: call.id || `gemini_${++this.sequence}`, name: call.name, input: call.args ?? {} });
          }
        }
      }
      let stopReason: ModelResult["stopReason"];
      if (finish === "MAX_TOKENS") stopReason = "max_tokens";
      else if (finish && REFUSALS.has(finish)) stopReason = "refusal";
      else if (finish === "STOP") stopReason = toolCalls.length ? "tool_use" : "end";
      else throw new ProviderCallError(`Gemini did not finish successfully (${finish ?? "incomplete stream"})`, model, usage);
      this.assistantParts.set(toolCalls, parts);
      return { text: texts.join(""), toolCalls, stopReason, usage: usage ?? { ...ZERO_USAGE }, model };
    } catch (e) {
      if (e instanceof ProviderCallError) throw e;
      // Stream/callback errors retain any usage reported before the failure.
      throw new ProviderCallError("Gemini stream failed", model, usage);
    }
  }
}
