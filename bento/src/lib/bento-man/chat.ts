/** One turn of Bento Man: the traveller says something, the model picks
 *  tools, the engine answers, the model narrates. Streams the prose as it
 *  arrives and returns the proposal the turn produced, if any.
 *
 *  Prompt caching (§09): the system prompt and tool list are byte-stable;
 *  everything that changes per turn — today's date, the trip state — rides
 *  in the final user message, after the cache breakpoint. */
import { addUsage, CHAT_MAX_OUTPUT_TOKENS, costUsd, totalUsage, ZERO_USAGE, type Usage, type UsageByModel } from "./cost";
import { ProviderCallError, type ChatProvider, type ModelMessage, type ToolResult } from "./provider";
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
  provider: ChatProvider;
  /** "YYYY-MM-DD" */
  today: string;
  message: string;
  events?: ChatEvents;
  /** Tool rounds per turn. Eight is plenty for plan-then-explain. */
  maxIterations?: number;
  historyLimit?: number;
  /** Skip persisting the turn (the eval runner keeps its own record). */
  persist?: boolean;
  /** Asked for before EVERY model call. It holds budget for that call and
   *  throws when none is left; the returned hold is settled with what the
   *  call really cost. Absent in the eval and the tests. */
  spend?: { hold(): Promise<CallHold> };
}

export interface CallHold {
  settle(usage: { model: string; inputTokens: number; outputTokens: number; cachedTokens?: number; costUsd: number } | null): Promise<void>;
}

const isSpendCap = (e: unknown) => e instanceof Error && e.name === "SpendCapExceeded";

export interface ToolCallRecord {
  name: string;
  input: unknown;
  ok: boolean;
}

export interface RunResult {
  text: string;
  proposal: Proposal | null;
  usage: Usage;
  /** Priced per model: a refusal fallback bills two models in one turn. */
  usageByModel: UsageByModel;
  stopReason: string | null;
  toolCalls: ToolCallRecord[];
  assistantMessageId: string | null;
  /** Which model actually served the turn (a fallback may have). */
  servedBy: string;
}

/** Adaptive thinking comes out of this too, so leave room: a truncated
 *  turn can cut a tool_use block in half. */
const MAX_TOKENS = CHAT_MAX_OUTPUT_TOKENS;
const REFUSAL_TEXT = "I can't help with that one. Ask me about the trip and I will.";

export async function runBentoMan(opts: RunOptions): Promise<RunResult> {
  const { store, provider, today, message, events } = opts;
  const maxIterations = opts.maxIterations ?? 8;
  const persist = opts.persist ?? true;

  const [history, state, cities] = await Promise.all([store.history(opts.historyLimit ?? 30), store.state(), store.cities()]);
  if (persist) await store.append("user", message);

  const context = buildContext(state, cities, today);
  const messages = conversation(history, `${context}\n\n${message}`);

  const ctx: ToolContext = { store, today, proposal: null };
  const texts: string[] = [];
  const toolCalls: ToolCallRecord[] = [];
  const usageByModel: UsageByModel = {};
  let stopReason: string | null = null;
  let servedBy = provider.model;

  // A turn that dies after a model call still cost money. The partial
  // usage rides on the error so the caller can record it (E2).
  const fail = (e: unknown) => {
    if (e instanceof Error) (e as Error & { usageByModel?: UsageByModel }).usageByModel = usageByModel;
    return e;
  };

  const account = async (model: string, usage: Usage, hold?: CallHold) => {
    usageByModel[model] = addUsage(usageByModel[model] ?? ZERO_USAGE, usage);
    await hold?.settle(
      usage.inputTokens || usage.outputTokens
        ? { model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, cachedTokens: usage.cacheReadTokens, costUsd: costUsd(model, usage) }
        : null,
    );
  };

  try {
  for (let i = 0; i < maxIterations; i++) {
    let hold: CallHold | undefined;
    if (opts.spend) {
      try {
        hold = await opts.spend.hold();
      } catch (e) {
        // Out of budget before the first call is the caller's to report;
        // out of budget between tool rounds just ends the turn here.
        if (i === 0 || !isSpendCap(e)) throw fail(e);
        texts.push("I've reached this month's Bento Man budget, so I'll stop here. Planning still works without me.");
        break;
      }
    }
    let msg;
    try {
      msg = await provider.call({ system: SYSTEM_PROMPT, messages, tools: TOOLS, maxOutputTokens: MAX_TOKENS, onText: events?.onText });
    } catch (e) {
      if (e instanceof ProviderCallError && e.usage) await account(e.model, e.usage, hold);
      else await hold?.settle(null);
      throw e;
    }

    // Price against the model that served this iteration, not the last one.
    await account(msg.model, msg.usage, hold);
    servedBy = msg.model;
    stopReason = msg.stopReason;

    if (msg.text.trim()) texts.push(msg.text.trim());

    if (msg.stopReason === "refusal") {
      texts.push(REFUSAL_TEXT);
      events?.onText?.(REFUSAL_TEXT);
      break;
    }
    if (msg.stopReason === "max_tokens") {
      // A cut-off turn can hold half a tool call. Never run it.
      texts.push("That answer ran long and got cut off. Ask me again, or narrower.");
      break;
    }
    if (msg.stopReason !== "tool_use") break;

    const uses = msg.toolCalls;
    if (!uses.length) break;
    messages.push({ role: "assistant", content: msg.text, toolCalls: uses });

    const results: ToolResult[] = [];
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
      results.push({ id: use.id, name: use.name, content: outcome.result, isError: outcome.isError || undefined });
    }
    messages.push({ role: "user", content: results });
  }

  } catch (e) {
    throw fail(e);
  }

  const text = texts.join("\n\n") || (ctx.proposal ? "Here is what I'd suggest." : "I didn't manage a reply that time. Try again.");
  let assistantMessageId: string | null = null;
  if (persist) {
    // The model has been paid by now: if saving the reply fails, the usage
    // must still ride on the error (E2).
    try {
      assistantMessageId = (await store.append("assistant", text, ctx.proposal)).id;
    } catch (e) {
      throw fail(e);
    }
  }

  return { text, proposal: ctx.proposal, usage: totalUsage(usageByModel), usageByModel, stopReason, toolCalls, assistantMessageId, servedBy };
}

/** The stored history as the API wants it: starting with the traveller,
 *  alternating, ending on this turn's message. The store doesn't guarantee
 *  that shape — "re-plan this day" writes a Bento Man message with no
 *  traveller turn before it, a failed turn leaves a traveller message with
 *  no reply, and the history window can start mid-exchange. Leading
 *  assistant turns are dropped and same-role neighbours merged, so one odd
 *  row can't make every later turn on the trip fail. */
export function conversation(history: { role: "user" | "assistant"; content: string }[], current: string): ModelMessage[] {
  const out: Extract<ModelMessage, { content: string }>[] = [];
  for (const h of [...history, { role: "user" as const, content: current }]) {
    if (!h.content.trim()) continue;
    if (!out.length && h.role === "assistant") continue;
    const last = out[out.length - 1];
    if (last && last.role === h.role) last.content = `${last.content}\n\n${h.content}`;
    else out.push(h.role === "user" ? { role: "user", content: h.content } : { role: "assistant", content: h.content });
  }
  return out;
}

/** Partial usage from a turn that threw, so a failed turn still counts. */
export function usageFromError(e: unknown): UsageByModel {
  return (e as { usageByModel?: UsageByModel })?.usageByModel ?? {};
}
