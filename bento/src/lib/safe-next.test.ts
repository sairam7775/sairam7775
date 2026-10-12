import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/trips")).toBe("/trips");
    expect(safeNext("/trips/abc?day=2026-11-20")).toBe("/trips/abc?day=2026-11-20");
    expect(safeNext("/admin")).toBe("/admin");
  });
  it("refuses anything that leaves the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "evil.example", "javascript:alert(1)", "/\t/evil.example", ""]) {
      expect(safeNext(bad)).toBe("/trips");
    }
  });
  it("falls back when missing", () => {
    expect(safeNext(null)).toBe("/trips");
    expect(safeNext(undefined, "/")).toBe("/");
  });
});
