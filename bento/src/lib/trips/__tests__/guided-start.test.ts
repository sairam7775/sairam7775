import { describe, expect, it } from "vitest";
import { guidedTitle, monthOptions, parseGuidedStart, starterMessage } from "../guided-start";

const form = (fields: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

describe("starterMessage", () => {
  it("says roughly when, who, the places in mind and what to avoid, then asks for a route", () => {
    expect(starterMessage({ when: "rough", month: "2026-11", nights: 10, people: 2, places: "Kyoto, Hiroshima", avoid: "long hikes" }))
      .toBe("About 10 nights in November 2026, 2 of us. Places in mind: Kyoto, Hiroshima. We'd rather avoid: long hikes. Can you suggest a route?");
  });

  it("leaves out what wasn't given", () => {
    expect(starterMessage({ when: "rough", month: "2026-11", nights: null, people: 1, places: "", avoid: "" }))
      .toBe("Sometime in November 2026, just me. Can you suggest a route?");
    expect(starterMessage({ when: "unsure", month: null, nights: null, people: 3, places: "", avoid: "" }))
      .toBe("We don't know our dates yet, 3 of us. Can you suggest a route?");
    expect(starterMessage({ when: "dates", month: null, nights: null, people: 2, places: "", avoid: "" }))
      .toBe("Our dates are in the trip, 2 of us. Can you suggest a route?");
  });
});

describe("guidedTitle", () => {
  it("names a rough trip after its month, so the trips list still says when", () => {
    expect(guidedTitle({ when: "rough", month: "2026-11", nights: 10 })).toBe("November 2026, about 10 nights");
    expect(guidedTitle({ when: "rough", month: "2026-11", nights: null })).toBe("November 2026");
    expect(guidedTitle({ when: "dates", month: null, nights: null })).toBeNull();
  });
});

describe("monthOptions", () => {
  it("offers this month and the eleven after it", () => {
    const months = monthOptions(new Date("2026-10-20T03:00:00Z"));
    expect(months).toHaveLength(12);
    expect(months[0]).toEqual({ value: "2026-10", label: "October 2026" });
    expect(months[11]).toEqual({ value: "2027-09", label: "September 2027" });
  });
});

describe("parseGuidedStart", () => {
  it("reads a rough plan, its preferences and only known interests", () => {
    const r = parseGuidedStart(form({ when: "rough", month: "2026-11", nights: "10", people: "2", pace: "relaxed", interests: ["food", "onsen", "skydiving"], places: " Kyoto ", avoid: "" }));
    expect(r).toEqual({ ok: true, value: { when: "rough", month: "2026-11", nights: 10, startDate: null, endDate: null, people: 2, pace: "relaxed", interests: ["food", "onsen"], places: "Kyoto", avoid: "" } });
  });

  it("needs a month for a rough plan, and dates the right way round", () => {
    expect(parseGuidedStart(form({ when: "rough", people: "1" })).ok).toBe(false);
    expect(parseGuidedStart(form({ when: "dates", startDate: "2026-11-29", endDate: "2026-11-20", people: "1" })).ok).toBe(false);
  });

  it("takes known dates, and treats missing ones as not sure yet", () => {
    const known = parseGuidedStart(form({ when: "dates", startDate: "2026-11-20", endDate: "2026-11-29", people: "2" }));
    expect(known.ok && known.value).toMatchObject({ when: "dates", startDate: "2026-11-20", endDate: "2026-11-29" });
    const missing = parseGuidedStart(form({ when: "dates", people: "2" }));
    expect(missing.ok && missing.value.when).toBe("unsure");
  });

  it("refuses nights or people out of range", () => {
    expect(parseGuidedStart(form({ when: "rough", month: "2026-11", nights: "45", people: "1" })).ok).toBe(false);
    expect(parseGuidedStart(form({ when: "unsure", people: "30" })).ok).toBe(false);
  });
});
