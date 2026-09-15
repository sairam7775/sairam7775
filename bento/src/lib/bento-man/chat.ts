/** One turn of Bento Man: the traveller says something, the model picks
 *  tools, the engine answers, the model narrates. Streams the prose as it
 *  arrives and returns the proposal the turn produced, if any.
 *
 *  Prompt caching (§09): the system prompt and tool list are byte-stable;
 *  everything that changes per turn — today's date, the trip state — rides
 *  in the final user message, after the cache breakpoint. */
import Anthropic from "@anthropic-ai/sdk";
import { addUsage, ZERO_USAGE, type Effort, type Usage } from "./cost";
import { buildContext } from "./context";
import type { Proposal } from "./diff";
import { SYSTEM_PROMPT } from "./prompt";
import type { TripStore } from "./store";
import { runTool, TOOLS, type ToolContext } from "./tools";

export interface ChatEvents {
  onText?: (delta: string) => void;
  onTool?: (name: string, phase: "start" | "end", ok: boolean) => void;
}

export interface RunOptions {
  store: TripStore;
  client: Anthropic;
  model: string;
  effort: Effort;
  /** "YYYY-MM-DD" */
  today: string;
  message: string;
  events?: ChatEvents;
  /** Tool rounds per turn. Eight is plenty for plan-then-explain. */
  maxIterations?: number;
  historyLimit?: number;
  /** Skip persisting the turn (the eval runner keeps its own record). */
  persist?: boolean;
}

export interface ToolCallRecord {
  name: string;
  input: unknown;
  ok: boolean;
}

export interface RunResult {
  text: string;
  proposal: Proposal | null;
  usage: Usage;
  stopReason: string | null;
  toolCalls: ToolCallRecord[];
  assistantMessageId: string | null;
  /** Which model actually served the turn (a fallback may have). */
  servedBy: string;
}

const MAX_TOKENS = 8192;
const REFUSAL_TEXT = "I can't help with that one. Ask me about the trip and I will.";

export async function runBentoMan(opts: RunOptions): Promise<RunResult> {
  const { store, client, model, effort, today, message, events } = opts;
  const maxIterations = opts.maxIterations ?? 8;
  const persist = opts.persist ?? true;

  const [history, state, cities] = await Promise.all([store.history(opts.historyLimit ?? 30), store.state(), store.cities()]);
  if (persist) await store.append("user", message);

  const context = buildContext(state, cities, today);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((h) => ({ role: h.role, content: h.content }) as Anthropic.Beta.BetaMessageParam),
    { role: "user", content: `${context}\n\n${message}` },
  ];

  const ctx: ToolContext = { store, today, proposal: null };
  const texts: string[] = [];
  const toolCalls: ToolCallRecord[] = [];
  let usage: Usage = ZERO_USAGE;
  let stopReason: string | null = null;
  let servedBy = model;

  for (let i = 0; i < maxIterations; i++) {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
      output_config: { effort },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });
    stream.on("text", (delta) => events?.onText?.(delta));
    const msg = await stream.finalMessage();

    usage = addUsage(usage, {
      inputTokens: msg.usage.input_tokens,
      outputTokens: msg.usage.output_tokens,
      cacheWriteTokens: msg.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: msg.usage.cache_read_input_tokens ?? 0,
    });
    servedBy = msg.model;
    stopReason = msg.stop_reason;

    for (const block of msg.content) if (block.type === "text" && block.text.trim()) texts.push(block.text.trim());

    if (msg.stop_reason === "refusal") {
      texts.push(REFUSAL_TEXT);
      events?.onText?.(REFUSAL_TEXT);
      break;
    }
    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    if (msg.stop_reason !== "tool_use") break;

    const uses = msg.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (!uses.length) break;
    messages.push({ role: "assistant", content: msg.content });

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of uses) {
      events?.onTool?.(use.name, "start", true);
      let outcome;
      try {
        outcome = await runTool(use.name, use.input, ctx);
      } catch (e) {
        outcome = { result: `tool failed: ${e instanceof Error ? e.message : String(e)}`, isError: true };
      }
      toolCalls.push({ name: use.name, input: use.input, ok: !outcome.isError });
      events?.onTool?.(use.name, "end", !outcome.isError);
      results.push({ type: "tool_result", tool_use_id: use.id, content: outcome.result, is_error: outcome.isError || undefined });
    }
    messages.push({ role: "user", content: results });
  }

  const text = texts.join("\n\n") || (ctx.proposal ? "Here is what I'd suggest." : "I didn't manage a reply that time. Try again.");
  let assistantMessageId: string | null = null;
  if (persist) assistantMessageId = (await store.append("assistant", text, ctx.proposal)).id;

  return { text, proposal: ctx.proposal, usage, stopReason, toolCalls, assistantMessageId, servedBy };
}
