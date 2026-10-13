import { describe, expect, it } from "vitest";
import { placeCard } from "./place";

const vw = 400;
const vh = 800;
const H = 190;

describe("placeCard", () => {
  it("goes below a short target near the top", () => {
    expect(placeCard({ top: 100, left: 20, width: 200, height: 50 }, H, 360, vw, vh).top).toBe(100 + 50 + 8 + 14);
  });
  it("goes above a target near the bottom", () => {
    expect(placeCard({ top: 600, left: 20, width: 200, height: 100 }, H, 360, vw, vh).top).toBe(600 - 8 - 14 - H);
  });
  it("stays on screen for a target almost the viewport's height", () => {
    // The trip page's chat panel, centred by scrollIntoView.
    const { top } = placeCard({ top: 30, left: 0, width: 400, height: 740 }, H, 376, vw, vh);
    expect(top).toBeGreaterThanOrEqual(12);
    expect(top + H).toBeLessThanOrEqual(vh - 12);
  });
  it("keeps the card inside the sides", () => {
    expect(placeCard({ top: 100, left: 380, width: 10, height: 10 }, H, 360, vw, vh).left).toBe(vw - 360 - 12);
  });
});
