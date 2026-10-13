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
  // Gemini Developer API free tier only. Update these before using paid billing.
  // https://ai.google.dev/gemini-api/docs/pricing
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

/** A generous ceiling on one call's input, uncached: system prompt, tools,
 *  thirty messages of history and the trip state. */
const CALL_INPUT_BOUND: Record<"chat" | "parse", { input: number; output: number }> = {
  chat: { input: 40_000, output: CHAT_MAX_OUTPUT_TOKENS },
  parse: { input: 8_000, output: 2_000 },
};

/** What ONE model call can cost at most, in USD. A spend hold is this, not
 *  a typical cost: a hold smaller than the spend lets parallel turns
 *  overshoot the cap together. */
export function callBoundUsd(model: string, kind: "chat" | "parse"): number {
  const b = CALL_INPUT_BOUND[kind];
  return costUsd(model, { inputTokens: b.input, outputTokens: b.output, cacheWriteTokens: 0, cacheReadTokens: 0 });
}

/** D8: Opus 5 first, Sonnet 5 measured against the eval before switching. */
export const DEFAULT_MODEL = "claude-opus-5";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export function configuredModel(provider: ProviderName = configuredProvider()): string {
  return process.env.BENTO_MAN_MODEL?.trim() || (provider === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_MODEL);
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Bento Man does intent and prose; the reasoning is in the engine. Medium
 *  is plenty for that and keeps a turn under a few seconds. */
export function configuredEffort(): Effort {
  const raw = process.env.BENTO_MAN_EFFORT?.trim();
  return raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh" || raw === "max" ? raw : "medium";
}
