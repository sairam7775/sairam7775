import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeValue, fieldLabel, sourceHref, suggestion } from "./review-notes";

describe("describeValue", () => {
  it("reads seasonal hours and split prices one entry at a time", () => {
    expect(describeValue({ "March–November": "17:00", "December–February": "16:30" })).toBe("March–November: 17:00 · December–February: 16:30");
    expect(describeValue({ grounds: 0, "Hojo garden": 400 })).toBe("grounds: 0 · Hojo garden: 400");
  });
  it("says plainly when a reviewer would empty the field", () => {
    expect(describeValue(null)).toBe("nothing (leave it empty)");
    expect(describeValue("")).toBe("nothing (leave it empty)");
    expect(describeValue({})).toBe("nothing (leave it empty)");
    expect(describeValue([])).toBe("none");
  });
  it("keeps plain values as they are", () => {
    expect(describeValue("18:00")).toBe("18:00");
    expect(describeValue(800)).toBe("800");
    expect(describeValue(["kiyomizudera.or.jp", "kyoto.travel"])).toBe("kiyomizudera.or.jp, kyoto.travel");
  });
});

describe("suggestion", () => {
  it("says keep only when the reviewer says the record is right", () => {
    expect(suggestion({ keep: true, note: "18:00 is right most of the year." })).toBe("Keep what Bento has");
    expect(suggestion({ note: "¥200 is outdated too; the museum lists ¥210." })).toBe("See the note");
  });
  it("tells a suggested empty field from no suggestion", () => {
    expect(suggestion({ suggested: null })).toBe("nothing (leave it empty)");
    expect(suggestion({ suggested: 800 })).toBe("800");
  });
});

describe("sourceHref", () => {
  it("links https addresses only", () => {
    expect(sourceHref("https://www.kiyomizudera.or.jp/access/")).toBe("https://www.kiyomizudera.or.jp/access/");
    expect(sourceHref("http://example.com/")).toBeNull();
    expect(sourceHref("javascript:alert(1)")).toBeNull();
    expect(sourceHref("own knowledge")).toBeNull();
    expect(sourceHref("kiyomizudera.or.jp")).toBeNull();
    expect(sourceHref(undefined)).toBeNull();
  });
});

describe("fieldLabel", () => {
  it("uses the editor's words and falls back to the field name", () => {
    expect(fieldLabel("closes")).toBe("Closes");
    expect(fieldLabel("crowdNote")).toBe("Crowd note");
    expect(fieldLabel("somethingNew")).toBe("somethingNew");
  });
});

describe("the table", () => {
  const sql = readFileSync(join(__dirname, "../../../supabase/migrations/0025_place_review_notes.sql"), "utf8");
  it("is closed to travellers", () => {
    expect(sql).toMatch(/alter table place_review_notes enable row level security;/);
    expect(sql).toMatch(/revoke all on place_review_notes from anon, authenticated;/);
    expect(sql).not.toMatch(/create policy/i);
  });
  it("allows exactly the kinds the pages know", () => {
    expect(sql).toContain("check (kind in ('disagree', 'different_fix'))");
  });
});
