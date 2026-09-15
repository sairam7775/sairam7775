/** What a model call costs, in USD, from its usage block.
 *
 *  The spend cap (E2) is only as honest as this table. Prices are per
 *  million tokens; cache writes are 1.25× input and cache reads 0.1×.
 *  Unknown models are charged at Opus rates, so a typo in BENTO_MAN_MODEL
 *  over-counts rather than under-counts. */

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

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model] ?? PRICES["claude-opus-5"];
  const perM = 1_000_000;
  return (
    (u.inputTokens * p.input +
      u.outputTokens * p.output +
      u.cacheWriteTokens * p.cacheWrite +
      u.cacheReadTokens * p.cacheRead) /
    perM
  );
}

/** D8: Opus 5 first, Sonnet 5 measured against the eval before switching. */
export const DEFAULT_MODEL = "claude-opus-5";

export function configuredModel(): string {
  return process.env.BENTO_MAN_MODEL?.trim() || DEFAULT_MODEL;
}

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/** Bento Man does intent and prose; the reasoning is in the engine. Medium
 *  is plenty for that and keeps a turn under a few seconds. */
export function configuredEffort(): Effort {
  const raw = process.env.BENTO_MAN_EFFORT?.trim();
  return raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh" || raw === "max" ? raw : "medium";
}
