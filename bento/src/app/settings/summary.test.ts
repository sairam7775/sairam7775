import { describe, expect, it } from "vitest";
import { appearanceSummary, personalSummary, privacySummary } from "./summary";

describe("Settings row summaries", () => {
  it("shows the name and email, or just the email when there's no name", () => {
    expect(personalSummary("Sai", "sai@example.com")).toBe("Sai · sai@example.com");
    expect(personalSummary("", "sai@example.com")).toBe("sai@example.com");
  });

  it("names the theme and background in use", () => {
    expect(appearanceSummary("system", "auto")).toBe("System theme · Automatic background");
    expect(appearanceSummary("dark", "winter")).toBe("Dark theme · Winter background");
  });

  it("mentions analytics only where it can run", () => {
    expect(privacySummary(null)).toBe("Your data, Bento's terms, delete account");
    expect(privacySummary(true)).toBe("Usage analytics on · your data · delete account");
    expect(privacySummary(false)).toBe("Usage analytics off · your data · delete account");
  });
});
