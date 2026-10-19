import { describe, expect, it } from "vitest";
import { centeredDayScrollLeft } from "./day-strip-scroll";

describe("centeredDayScrollLeft", () => {
  it("centres the selected chip inside the strip", () => {
    expect(centeredDayScrollLeft({
      stripLeft: 10,
      stripScrollLeft: 100,
      stripClientWidth: 300,
      stripScrollWidth: 1_000,
      chipLeft: 300,
      chipWidth: 120,
    })).toBe(300);
  });

  it("keeps the selected chip visible at either end", () => {
    const bounds = {
      stripLeft: 0,
      stripScrollLeft: 0,
      stripClientWidth: 300,
      stripScrollWidth: 1_000,
      chipWidth: 120,
    };
    expect(centeredDayScrollLeft({ ...bounds, chipLeft: 0 })).toBe(0);
    expect(centeredDayScrollLeft({ ...bounds, chipLeft: 900 })).toBe(700);
  });
});
