import { afterEach, describe, expect, it, vi } from "vitest";
import { callBoundUsd, configuredModel, costUsd, ZERO_USAGE } from "../cost";
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
    expect(configuredModel()).toBe("gemini-2.5-flash");
    expect(new GeminiProvider("fake-key").model).toBe("gemini-2.5-flash");
    expect(providerKeyVariable(configuredProvider())).toBe("GEMINI_API_KEY");
    vi.stubEnv("BENTO_MAN_MODEL", "gemini-2.5-flash-lite");
    expect(configuredModel()).toBe("gemini-2.5-flash-lite");
    expect(new GeminiProvider("fake-key").model).toBe("gemini-2.5-flash-lite");
  });

  it.each(["gemini-2.5-flash", "gemini-2.5-flash-lite"])("prices free-tier %s at zero including spend holds", (model) => {
    expect(costUsd(model, { inputTokens: 1000, outputTokens: 100, cacheWriteTokens: 500, cacheReadTokens: 200 })).toBe(0);
    expect(callBoundUsd(model, "chat")).toBe(0);
  });

  it("retains the unknown-Claude fallback and requires prices for other unknown models", () => {
    expect(callBoundUsd("claude-future", "chat")).toBe(callBoundUsd("claude-opus-5", "chat"));
    expect(() => costUsd("other-model", ZERO_USAGE)).toThrow("No price configured");
  });
});
