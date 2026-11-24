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
      expect(text).toMatch(/text blanked/i);
      expect(text).toMatch(/browser and device/i);
    });
  }

  it("no place that asks promises more than the code backs", () => {
    // Error reports aren't scrubbed of their message, so no flat "never".
    for (const text of [...Object.values(asks), copy.privacy.sections.analytics.body]) expect(text).not.toMatch(/\bnever (what you type|recorded)\b/i);
  });

  it("the privacy page names recordings, heatmaps, masking, errors and device details", () => {
    const body = copy.privacy.sections.analytics.body;
    for (const word of [/screen recordings/i, /heatmaps/i, /mouse/i, /scroll/i, /blank out all text and every field/i, /error's message/i, /browser, operating system, device type and screen size/i]) expect(body).toMatch(word);
  });
});
