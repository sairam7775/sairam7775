import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { copy } from ".";

// With analytics allowed, PostHog records sessions (`session_recording` in
// lib/analytics/client.ts, every piece of text and field blanked), sends
// heatmap data (where people click and how far they scroll), seen in the
// requests to /ingest on 23 Nov 2026, and its default browser and device
// properties. A yes has to be a yes to that, so every place that asks (the
// banner, Settings, the cookies page's own Allow) says so, and the privacy
// page explains it. These check the words are there, not that the code
// masks: client.ts's config is what masks.
const asks = {
  "consent banner": copy.consent.body,
  "Settings": copy.settings.analytics.body,
  "cookies page choice": copy.cookies.choice.body,
};

describe("what a yes to analytics covers", () => {
  for (const [where, text] of Object.entries(asks)) {
    it(`the ${where} names recordings, heatmaps, masking and the device`, () => {
      expect(text).toMatch(/screen recordings/i);
      expect(text).toMatch(/heatmaps/i);
      expect(text).toMatch(/click/i);
      expect(text).toMatch(/scroll/i);
      expect(text).toMatch(/text and fields blanked/i);
      expect(text).toMatch(/browser and device/i);
    });
  }

  it("no place promises that nothing typed ever reaches analytics", () => {
    // Not until every PostHog path is audited: features switched on from
    // PostHog's own settings (the recorder's channels, dead clicks, the
    // toolbar) run code that isn't in this repo (Codex, 25 Nov 2026).
    const overclaims = [/never recorded/i, /never what you type/i, /not to collect what you type/i, /ever includes what you type/i];
    for (const old of [
      "Never what you type, your bookings or your email.",
      "so what you type and your bookings are never recorded.",
      "It's built not to collect what you type, your bookings or your email.",
      "None of it ever includes what you type, your bookings or your email.",
    ]) expect(overclaims.some((p) => p.test(old)), old).toBe(true);
    for (const text of [...Object.values(asks), copy.privacy.sections.analytics.body])
      for (const p of overclaims) expect(text).not.toMatch(p);
  });

  it("errors are said to go without their message, and the code that does it is in place", () => {
    expect(copy.privacy.sections.analytics.body).toMatch(/without their message/);
    // safe-error.test.ts checks the payload; this keeps the wiring.
    const client = readFileSync(join(__dirname, "../lib/analytics/client.ts"), "utf8");
    expect(client).toMatch(/capture_exceptions: false/);
    expect(client).toMatch(/captureException\(safe,/);
    expect(client).toMatch(/return scrubEvent\(event\)/);
  });

  it("the privacy page names recordings, heatmaps, masking, errors and device details", () => {
    const body = copy.privacy.sections.analytics.body;
    for (const word of [/screen recordings/i, /heatmaps/i, /mouse/i, /scroll/i, /blank out all text and every field/i, /without their message/i, /browser, operating system, device type and screen size/i]) expect(body).toMatch(word);
  });
});
