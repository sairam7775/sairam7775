import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CHALLENGES, datesBetween, HARD_DAYS_MAX, NOTE_MAX, OUTCOMES, parseReview, reviewFromRow, reviewOpen, snapshotCities, snapshotFromRow } from "../review";
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
  it("refuses more hard days than the database keeps", () => {
    const long = { startDate: "2026-01-01", endDate: "2026-12-31" };
    const days = Array.from({ length: HARD_DAYS_MAX + 1 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10));
    expect(parseReview(form([["outcome", "mostly"], ...days.map((d): [string, string] => ["hardDay", d])]), long)).toEqual({ ok: false, error: copy.review.errors.tooManyDays(HARD_DAYS_MAX) });
    expect(parseReview(form([["outcome", "mostly"], ...days.slice(1).map((d): [string, string] => ["hardDay", d])]), long).ok).toBe(true);
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

describe("snapshotFromRow", () => {
  it("reads the plan the database saved (0019 trigger), and nothing else", () => {
    const saved = {
      start: "2026-11-22",
      end: "2026-11-24",
      party: 2,
      route: [{ city: "Osaka", nights: 2 }, { city: "Kyoto", nights: 4 }],
      days: [
        { date: "2026-11-23", city: "Kyoto", stops: [{ time: "07:00", name: "Kiyomizu-dera" }, { time: null, name: "Somewhere" }] },
        { date: "2026-11-24", city: null, stops: [] },
      ],
    };
    expect(snapshotFromRow(saved)).toEqual(saved);
    expect(snapshotFromRow(null)).toBeNull();
    expect(snapshotFromRow({ route: "Kyoto" })).toBeNull();
  });
});

describe("snapshotCities", () => {
  it("gives every date of a saved plan its city, days with no stops included", () => {
    const plan = {
      start: "2026-11-20",
      end: "2026-11-24",
      party: 2,
      route: [{ city: "Osaka", nights: 1 }, { city: "Kyoto", nights: 3 }],
      days: [{ date: "2026-11-22", city: "Nara", stops: [{ time: "09:00", name: "Todai-ji" }] }],
    };
    expect([...snapshotCities(plan)].sort()).toEqual([
      ["2026-11-20", "Osaka"],
      ["2026-11-21", "Kyoto"],
      ["2026-11-22", "Nara"],
      ["2026-11-23", "Kyoto"],
      ["2026-11-24", "Kyoto"],
    ]);
    expect(snapshotCities({ ...plan, start: null, end: null, days: [] }).size).toBe(0);
  });
});

describe("datesBetween", () => {
  it("lists every date, both ends included", () => {
    expect(datesBetween("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
    expect(datesBetween("2026-11-20", "2026-11-20")).toEqual(["2026-11-20"]);
    expect(datesBetween("2026-11-21", "2026-11-20")).toEqual([]);
    expect(datesBetween(null, "2026-11-20")).toEqual([]);
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
