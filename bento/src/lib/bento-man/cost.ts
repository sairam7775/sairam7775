/** What a model call costs, in USD, from its usage block.
 *
 *  The spend cap (E2) is only as honest as this table. Prices are per
 *  million tokens; cache writes are 1.25× input and cache reads 0.1×.
 *  Unknown Claude models are charged at Opus rates. Other unknown models
 *  must have an explicit price before they can take a spend hold. */
import { configuredProvider, type ProviderName } from "./provider";

export interface Price {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const PRICES: Record<string, Price> = {
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-opus-4-8": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheWrite: 1.25, cacheRead: 0.1 },
  // Paid-tier Standard rates as of 2026-10-14 (they rise on 2027-01-01). On the
  // free tier the real cost is zero, so the cap only errs on the safe side.
  // Gemini bills cache storage, not cache writes; a write is charged as input.
  // https://ai.google.dev/gemini-api/docs/pricing
  "gemini-3.8-flash": { input: 0.75, output: 3.75, cacheWrite: 0.75, cacheRead: 0.075 },
  "gemini-3.6-flash": { input: 0.75, output: 3.75, cacheWrite: 0.75, cacheRead: 0.075 },
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5, cacheWrite: 0.25, cacheRead: 0.025 },
  // Free tier only, and closed to new API keys (404 "no longer available to new users").
  "gemini-2.5-flash": { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  "gemini-2.5-flash-lite": { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  mock: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
};

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}

export const ZERO_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 };

export function addUsage(a: Usage, b: Partial<Usage>): Usage {
  return {
    inputTokens: a.inputTokens + (b.inputTokens ?? 0),
    outputTokens: a.outputTokens + (b.outputTokens ?? 0),
    cacheWriteTokens: a.cacheWriteTokens + (b.cacheWriteTokens ?? 0),
    cacheReadTokens: a.cacheReadTokens + (b.cacheReadTokens ?? 0),
  };
}

/** Usage split by the model that actually served it. A refusal fallback
 *  means one turn can be billed at two models' rates. */
export type UsageByModel = Record<string, Usage>;

export function costOfAll(byModel: UsageByModel): number {
  return Object.entries(byModel).reduce((sum, [model, u]) => sum + costUsd(model, u), 0);
}

export function totalUsage(byModel: UsageByModel): Usage {
  return Object.values(byModel).reduce(addUsage, ZERO_USAGE);
}

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model] ?? (model.startsWith("claude-") ? PRICES["claude-opus-5"] : undefined);
  if (!p) throw new Error(`No price configured for model: ${model}`);
  const perM = 1_000_000;
  return (
    (u.inputTokens * p.input +
      u.outputTokens * p.output +
      u.cacheWriteTokens * p.cacheWrite +
      u.cacheReadTokens * p.cacheRead) /
    perM
  );
}

/** The most one model call can output. Bento Man's own cap on a reply, and
 *  the figure a spend hold is sized from. */
export const CHAT_MAX_OUTPUT_TOKENS = 24_000;

/** The usual ceiling on one chat call's input: system prompt, tools, thirty
 *  messages of history and the trip state. A request can be longer (long
 *  replies, tool results piling up in a turn), so a hold is sized to the
 *  request's own estimate whenever that is bigger. */
export const CHAT_INPUT_BOUND = 40_000;

/** What a call is for: Bento Man's chat, the booking reader, or drafting a
 *  place background (whose input includes the official pages it reads). */
export type CallKind = "chat" | "parse" | "draft";

/** A drafted background is two to four sentences; the request sets this as
 *  its output limit (thinking included), so the hold's bound is enforced. */
export const DRAFT_MAX_OUTPUT_TOKENS = 8_000;

/** The input window of the Gemini models Bento uses: no request is bigger. */
const GEMINI_CONTEXT_TOKENS = 1_048_576;

const CALL_INPUT_BOUND: Record<CallKind, { input: number; output: number }> = {
  chat: { input: CHAT_INPUT_BOUND, output: CHAT_MAX_OUTPUT_TOKENS },
  parse: { input: 8_000, output: 2_000 },
  // url_context's retrieved pages count as input and nothing caps them
  // (up to 20 URLs of 34 MB each), so a draft allows for Gemini's whole
  // context window. An admin script's hold; it settles at the real cost.
  draft: { input: GEMINI_CONTEXT_TOKENS, output: DRAFT_MAX_OUTPUT_TOKENS },
};

/** What ONE model call can cost at most, in USD. A spend hold is this, not
 *  a typical cost: a hold smaller than the spend lets parallel turns
 *  overshoot the cap together. `inputTokens` is the request's estimate
 *  (`estimateInputTokens`); the hold never drops below the usual ceiling.
 *  Input is priced at the dearer of the input and cache-write rates, since
 *  a call may write its prompt to the cache. */
export function callBoundUsd(model: string, kind: CallKind, inputTokens = 0): number {
  const b = CALL_INPUT_BOUND[kind];
  const input = Math.max(b.input, inputTokens);
  const output = { inputTokens: 0, outputTokens: b.output, cacheWriteTokens: 0, cacheReadTokens: 0 };
  return Math.max(costUsd(model, { ...output, inputTokens: input }), costUsd(model, { ...output, cacheWriteTokens: input }));
}

/** An upper bound on a request's input tokens: its UTF-8 size in bytes.
 *  Every token is at least one byte (byte-level tokenisers fall back to
 *  single bytes), so no text, however token-dense, has more tokens than
 *  bytes; typical text has far fewer, and the JSON adds some more. */
export function estimateInputTokens(request: { system: string; tools: unknown; messages: unknown }): number {
  const text = request.system + JSON.stringify(request.tools) + JSON.stringify(request.messages);
  return new TextEncoder().encode(text).length;
}

/** D8: Opus 5 first, Sonnet 5 measured against the eval before switching. */
export const DEFAULT_MODEL = "claude-opus-5";
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";

export function configuredModel(provider: ProviderName = configuredProvider()): string {
  return process.env.BENTO_MAN_MODEL?.trim() || (provider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_MODEL);
}

/** Gemini models to try, in order, when the one before is out of quota or
 *  overloaded. Each free-tier model has its own daily quota. Anthropic has
 *  none here: its fallback is server-side (`fallbacks: "default"`). Every
 *  model listed must pass the eval, like the primary. "none" turns it off. */
export const DEFAULT_GEMINI_FALLBACKS = ["gemini-3.6-flash", "gemini-3.1-flash-lite"];

export function configuredFallbacks(provider: ProviderName = configuredProvider(), primary = configuredModel(provider)): string[] {
  if (provider !== "gemini") return [];
  const raw = process.env.BENTO_MAN_FALLBACK_MODELS?.trim();
  const list = raw === "none" ? [] : raw ? raw.split(",").map((m) => m.trim()).filter(Boolean) : DEFAULT_GEMINI_FALLBACKS;
  return [...new Set(list)].filter((m) => m !== primary);
}

/** A hold must cover whichever model in the chain ends up answering. */
export function chainBoundUsd(models: string[], kind: CallKind, inputTokens = 0): number {
  return Math.max(...models.map((m) => callBoundUsd(m, kind, inputTokens)));
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Bento Man does intent and prose; the reasoning is in the engine. Medium
 *  is plenty for that and keeps a turn under a few seconds. */
export function configuredEffort(): Effort {
  const raw = process.env.BENTO_MAN_EFFORT?.trim();
  return raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh" || raw === "max" ? raw : "medium";
}
