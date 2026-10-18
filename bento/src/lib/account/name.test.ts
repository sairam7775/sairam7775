import { describe, expect, it } from "vitest";
import { NAME_MAX, cleanName, displayName } from "./name";

describe("cleanName", () => {
  it("trims and collapses spaces", () => {
    expect(cleanName("  Sai   Ram  ")).toBe("Sai Ram");
  });
  it("drops control and direction characters", () => {
    expect(cleanName("Sai\u202e\u0007\nRam")).toBe("Sai Ram");
  });
  it("caps the length by characters, not bytes", () => {
    expect([...cleanName("た".repeat(60))]).toHaveLength(NAME_MAX);
  });
  it("treats anything but text as no name", () => {
    expect(cleanName(undefined)).toBe("");
    expect(cleanName(42)).toBe("");
  });
});

describe("displayName", () => {
  it("is the name they gave", () => {
    expect(displayName({ user_metadata: { display_name: "Sai" } })).toBe("Sai");
  });
  it("is null with no metadata or no name", () => {
    expect(displayName(null)).toBeNull();
    expect(displayName({ user_metadata: {} })).toBeNull();
  });
  it("falls back to the first name Google sent", () => {
    expect(displayName({ user_metadata: { given_name: "Hana", full_name: "Hana Sato" } })).toBe("Hana");
    expect(displayName({ user_metadata: { full_name: "Hana Sato" } })).toBe("Hana");
    expect(displayName({ user_metadata: { name: "Hana Sato" } })).toBe("Hana");
  });
  it("keeps a cleared name cleared, even with a Google name there", () => {
    expect(displayName({ user_metadata: { display_name: "", full_name: "Hana Sato" } })).toBeNull();
    expect(displayName({ user_metadata: { display_name: null, full_name: "Hana Sato" } })).toBeNull();
  });
  it("cleans a name written straight to the metadata", () => {
    expect(displayName({ user_metadata: { display_name: "  Sai\u202e  " } })).toBe("Sai");
  });
});
