import { describe, expect, it } from "vitest";
import { copy } from ".";

// With analytics allowed, PostHog records sessions (`session_recording` in
// lib/analytics/client.ts, every piece of text and field blanked) and sends
// heatmap data (where people click and how far they scroll), seen in the
// requests to /ingest on 23 Nov 2026. A yes has to be a yes to that, so the
// question itself and Settings name the recordings, and the privacy page
// names both.
describe("what a yes to analytics covers", () => {
  it("the consent question and Settings say screen recordings, with text blanked", () => {
    for (const text of [copy.consent.body, copy.settings.analytics.body]) {
      expect(text).toMatch(/screen recordings/i);
      expect(text).toMatch(/text blanked/i);
    }
  });

  it("the privacy page names recordings and heatmaps, and what each holds", () => {
    const body = copy.privacy.sections.analytics.body;
    expect(body).toMatch(/screen recordings/i);
    expect(body).toMatch(/heatmaps/i);
    expect(body).toMatch(/mouse/i);
    expect(body).toMatch(/scroll/i);
  });
});
