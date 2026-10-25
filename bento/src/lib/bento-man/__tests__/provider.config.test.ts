import { afterEach, describe, expect, it, vi } from "vitest";
import { callBoundUsd, chainBoundUsd, configuredFallbacks, configuredModel, costUsd, estimateInputTokens, ZERO_USAGE } from "../cost";
import { configuredProvider, providerKeyVariable } from "../provider";
import { GeminiProvider } from "../provider.gemini";

afterEach(() => vi.unstubAllEnvs());

describe("provider configuration and pricing", () => {
  it("defaults to Anthropic and its existing model", () => {
    vi.stubEnv("BENTO_MAN_PROVIDER", "");
    vi.stubEnv("BENTO_MAN_MODEL", "");
    expect(configuredProvider()).toBe("anthropic");
    expect(configuredModel()).toBe("claude-opus-5");
    expect(providerKeyVariable(configuredProvider())).toBe("ANTHROPIC_API_KEY");
  });

  it("selects Gemini's default, key variable and optional model override", () => {
    vi.stubEnv("BENTO_MAN_PROVIDER", "gemini");
    vi.stubEnv("BENTO_MAN_MODEL", "");
    expect(configuredModel()).toBe("gemini-3.8-flash");
    expect(new GeminiProvider("fake-key").model).toBe("gemini-3.8-flash");
    expect(providerKeyVariable(configuredProvider())).toBe("GEMINI_API_KEY");
    vi.stubEnv("BENTO_MAN_MODEL", "gemini-2.5-flash-lite");
    expect(configuredModel()).toBe("gemini-2.5-flash-lite");
    expect(new GeminiProvider("fake-key").model).toBe("gemini-2.5-flash-lite");
  });

  it.each(["gemini-2.5-flash", "gemini-2.5-flash-lite"])("prices free-tier %s at zero including spend holds", (model) => {
    expect(costUsd(model, { inputTokens: 1000, outputTokens: 100, cacheWriteTokens: 500, cacheReadTokens: 200 })).toBe(0);
    expect(callBoundUsd(model, "chat")).toBe(0);
  });

  it("prices the default Gemini model at paid-tier rates so the cap holds on paid billing", () => {
    expect(costUsd("gemini-3.8-flash", { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheWriteTokens: 0, cacheReadTokens: 1_000_000 })).toBeCloseTo(0.75 + 3.75 + 0.075);
    expect(callBoundUsd("gemini-3.8-flash", "chat")).toBeGreaterThan(0);
  });

  it("lists Gemini fallbacks, honours an override and \"none\", and sizes holds to the dearest model", () => {
    vi.stubEnv("BENTO_MAN_FALLBACK_MODELS", "");
    expect(configuredFallbacks("gemini", "gemini-3.8-flash")).toEqual(["gemini-3.6-flash", "gemini-3.1-flash-lite"]);
    expect(configuredFallbacks("gemini", "gemini-3.6-flash")).toEqual(["gemini-3.1-flash-lite"]);
    expect(configuredFallbacks("anthropic", "claude-opus-5")).toEqual([]);
    vi.stubEnv("BENTO_MAN_FALLBACK_MODELS", "gemini-3.1-flash-lite, gemini-3.6-flash");
    expect(configuredFallbacks("gemini", "gemini-3.8-flash")).toEqual(["gemini-3.1-flash-lite", "gemini-3.6-flash"]);
    vi.stubEnv("BENTO_MAN_FALLBACK_MODELS", "none");
    expect(configuredFallbacks("gemini", "gemini-3.8-flash")).toEqual([]);
    expect(chainBoundUsd(["gemini-3.1-flash-lite", "gemini-3.8-flash"], "chat")).toBe(callBoundUsd("gemini-3.8-flash", "chat"));
    expect(() => chainBoundUsd(["gemini-3.8-flash", "unpriced-model"], "chat")).toThrow("No price configured");
  });

  it("retains the unknown-Claude fallback and requires prices for other unknown models", () => {
    expect(callBoundUsd("claude-future", "chat")).toBe(callBoundUsd("claude-opus-5", "chat"));
    expect(() => costUsd("other-model", ZERO_USAGE)).toThrow("No price configured");
  });
});

describe("spend hold size", () => {
  it("prices a hold's input at the dearer of the input and cache-write rates", () => {
    expect(callBoundUsd("claude-opus-5", "chat")).toBeCloseTo((40_000 * 6.25 + 24_000 * 25) / 1_000_000);
  });

  it("grows with a request bigger than the usual ceiling, and never shrinks below it", () => {
    expect(callBoundUsd("gemini-3.8-flash", "chat", 100_000)).toBeCloseTo((100_000 * 0.75 + 24_000 * 3.75) / 1_000_000);
    expect(callBoundUsd("gemini-3.8-flash", "chat", 1_000)).toBe(callBoundUsd("gemini-3.8-flash", "chat"));
    expect(chainBoundUsd(["gemini-3.1-flash-lite", "gemini-3.8-flash"], "chat", 100_000)).toBe(callBoundUsd("gemini-3.8-flash", "chat", 100_000));
  });

  it("estimates a request's input generously, Japanese included", () => {
    const request = (content: string) => ({ system: "", tools: [], messages: [{ role: "user", content }] });
    expect(estimateInputTokens(request("東大寺".repeat(1000)))).toBeGreaterThanOrEqual(3000);
    expect(estimateInputTokens(request("hello ".repeat(1000)))).toBeGreaterThanOrEqual(1500);
    expect(estimateInputTokens(request("a".repeat(8000)))).toBeGreaterThan(estimateInputTokens(request("a".repeat(4000))));
  });

  it("never counts fewer tokens than bytes, so token-dense text can't outgrow its hold (Codex review on #54)", () => {
    const dense = "鬱鬯龘".repeat(1000) + "x7Qz9K".repeat(1000);
    const bytes = new TextEncoder().encode(JSON.stringify([{ role: "user", content: dense }])).length;
    expect(estimateInputTokens({ system: "", tools: [], messages: [{ role: "user", content: dense }] })).toBeGreaterThanOrEqual(bytes);
  });
});
