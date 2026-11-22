import { describe, expect, it } from "vitest";
import { webVitalProps } from "./web-vitals";

describe("webVitalProps", () => {
  it("keeps only the metric's name, value and rating", () => {
    const metric = {
      name: "LCP",
      value: 2134.56,
      rating: "good",
      id: "v5-123",
      delta: 2134.56,
      navigationType: "navigate",
      navigationURL: "https://bento.example/trips/abc?x=1",
      entries: [{ element: "<p>Hello</p>" }],
    };
    expect(webVitalProps(metric)).toEqual({ metric: "LCP", value: 2135, rating: "good" });
  });

  it("reports INP in whole milliseconds and CLS to three places", () => {
    expect(webVitalProps({ name: "INP", value: 184.4, rating: "good" })).toEqual({ metric: "INP", value: 184, rating: "good" });
    expect(webVitalProps({ name: "CLS", value: 0.123456, rating: "needs-improvement" })).toEqual({ metric: "CLS", value: 0.123, rating: "needs-improvement" });
  });

  it("ignores the metrics Bento doesn't budget", () => {
    for (const name of ["FCP", "TTFB", "Next.js-hydration", "Next.js-render"]) {
      expect(webVitalProps({ name, value: 100, rating: "good" })).toBeNull();
    }
  });

  it("drops a rating it doesn't know and a value that isn't a number", () => {
    expect(webVitalProps({ name: "LCP", value: 900, rating: "<script>" })).toEqual({ metric: "LCP", value: 900, rating: null });
    expect(webVitalProps({ name: "LCP", value: Number.NaN, rating: "good" })).toBeNull();
  });
});
