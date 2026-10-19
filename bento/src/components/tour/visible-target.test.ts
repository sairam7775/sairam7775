import { describe, expect, it } from "vitest";
import { firstVisibleTarget } from "./visible-target";

describe("firstVisibleTarget", () => {
  it("returns the first target with a non-zero size", () => {
    const targets = [
      { name: "hidden", width: 0, height: 0 },
      { name: "visible", width: 44, height: 44 },
      { name: "also visible", width: 100, height: 20 },
    ];
    expect(firstVisibleTarget(targets, (target) => target)).toBe(targets[1]);
  });

  it("returns none when every target has no size", () => {
    expect(firstVisibleTarget([{ width: 0, height: 20 }, { width: 20, height: 0 }], (target) => target)).toBeNull();
  });
});
