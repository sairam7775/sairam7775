import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHALLENGES, NOTE_MAX, OUTCOMES, parseReview, planSnapshot, reviewFromRow, reviewOpen, snapshotFromRow } from "../review";
import { copy } from "@/copy";

const trip = { startDate: "2026-11-20", endDate: "2026-11-29" };
const form = (entries: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of entries) f.append(k, v);
  return f;
};

describe("reviewOpen", () => {
  it("opens on the trip's last day, not before, and only with a plan", () => {
    expect(reviewOpen(trip, true, "2026-11-28")).toBe(false);
    expect(reviewOpen(trip, true, "2026-11-29")).toBe(true);
    expect(reviewOpen(trip, true, "2027-03-01")).toBe(true);
    expect(reviewOpen(trip, false, "2027-03-01")).toBe(false);
    expect(reviewOpen({ endDate: null }, true, "2027-03-01")).toBe(false);
  });
});

describe("parseReview", () => {
  it("reads an answer, dropping repeats and an empty note", () => {
    const r = parseReview(form([["outcome", "mostly"], ["challenge", "crowds"], ["challenge", "crowds"], ["challenge", "walking"], ["hardDay", "2026-11-23"], ["hardDay", "2026-11-21"], ["note", "  "]]), trip);
    expect(r).toEqual({ ok: true, review: { outcome: "mostly", challenges: ["crowds", "walking"], hardDays: ["2026-11-21", "2026-11-23"], note: null } });
  });
  it("needs the first question, and nothing else", () => {
    expect(parseReview(form([["note", "great"]]), trip)).toEqual({ ok: false, error: copy.review.errors.outcome });
    expect(parseReview(form([["outcome", "as_planned"]]), trip).ok).toBe(true);
  });
  it("refuses keys the database wouldn't accept", () => {
    expect(parseReview(form([["outcome", "great"]]), trip).ok).toBe(false);
    expect(parseReview(form([["outcome", "mostly"], ["challenge", "weather"]]), trip).ok).toBe(false);
  });
  it("refuses a day outside the trip and a note that is too long", () => {
    expect(parseReview(form([["outcome", "mostly"], ["hardDay", "2026-12-01"]]), trip)).toEqual({ ok: false, error: copy.review.errors.dayOutside });
    expect(parseReview(form([["outcome", "mostly"], ["note", "x".repeat(NOTE_MAX + 1)]]), trip)).toEqual({ ok: false, error: copy.review.errors.noteTooLong(NOTE_MAX) });
  });
});

describe("reviewFromRow", () => {
  it("drops anything it doesn't know rather than showing it", () => {
    expect(reviewFromRow(null)).toBeNull();
    expect(reviewFromRow({ outcome: "odd", challenges: [], hard_days: [], note: null })).toBeNull();
    expect(reviewFromRow({ outcome: "not_really", challenges: ["crowds", "weather"], hard_days: null, note: "n" })).toEqual({ outcome: "not_really", challenges: ["crowds"], hardDays: [], note: "n" });
  });
});

describe("planSnapshot", () => {
  const item = (name: string, sortOrder: number, startMin: number | null) => ({ placeId: name, name, sortOrder, startMin, durationMin: 60, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null });
  it("keeps the route in order and every day's stops with their times, naming day-trip cities", () => {
    const snap = planSnapshot({
      cities: [
        { cityId: "kyoto-city", name: "Kyoto", tier: "deep", nights: 4, sortOrder: 1, budgetBand: null, reason: null, arriveDate: null, departDate: null },
        { cityId: "osaka-city", name: "Osaka", tier: "deep", nights: 2, sortOrder: 0, budgetBand: null, reason: null, arriveDate: null, departDate: null },
      ],
      days: [
        { date: "2026-11-24", cityId: "nara-city", items: [item("Todai-ji", 0, 600)] },
        { date: "2026-11-23", cityId: "kyoto-city", items: [item("Kodai-ji", 1, 540), item("Kiyomizu-dera", 0, 420), item("Somewhere", 2, null)] },
      ],
    }, { "nara-city": "Nara" });
    expect(snap).toEqual({
      route: [{ city: "Osaka", nights: 2 }, { city: "Kyoto", nights: 4 }],
      days: [
        { date: "2026-11-23", city: "Kyoto", stops: [{ time: "07:00", name: "Kiyomizu-dera" }, { time: "09:00", name: "Kodai-ji" }, { time: null, name: "Somewhere" }] },
        { date: "2026-11-24", city: "Nara", stops: [{ time: "10:00", name: "Todai-ji" }] },
      ],
    });
    expect(snapshotFromRow(JSON.parse(JSON.stringify(snap)))).toEqual(snap);
    expect(snapshotFromRow(null)).toBeNull();
    expect(snapshotFromRow({ route: "Kyoto" })).toBeNull();
  });
});

describe("the keys", () => {
  it("match the database's check constraints and have words in the copy file", () => {
    const sql = readFileSync(join(__dirname, "../../../../supabase/migrations/0019_trip_reviews.sql"), "utf8");
    for (const o of OUTCOMES) expect(sql).toContain(`'${o}'`);
    for (const c of CHALLENGES) expect(sql).toContain(`'${c}'`);
    expect(Object.keys(copy.review.outcomes)).toEqual([...OUTCOMES]);
    expect(Object.keys(copy.review.challenges)).toEqual([...CHALLENGES]);
  });
});
