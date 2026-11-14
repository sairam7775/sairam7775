import { describe, expect, it } from "vitest";
import { copy } from "@/copy";
import { bentoManTip } from "../bento-man-tip";
import { detectGaps, type Gap } from "../gaps";

const t = copy.vault.bentoMan;

const gap = (key: string, title: string, ask?: string): Gap => ({
  key, severity: "blocking", title, detail: "", date: null, bookingType: null,
  actions: [
    { label: "Add a booking", kind: "add_booking" },
    ...(ask ? [{ label: "Ask Bento Man", kind: "ask_bento_man" as const, hint: ask }] : []),
  ],
});

describe("bentoManTip", () => {
  it("leads with the first gap and offers to help when he can", () => {
    const tip = bentoManTip({ gaps: [gap("bed:1", "Nowhere to sleep on 12 April.", "Where should we stay on 12 April?")], dismissed: [], coveredNights: 5, totalNights: 5 }, { welcome: false });
    expect(tip.lead).toBeNull();
    expect(tip.tip).toBe(`Nowhere to sleep on 12 April. ${t.offer}`);
    expect(tip.asks).toEqual([{ key: "bed:1", question: "Where should we stay on 12 April?" }]);
  });

  it("gives at most three quick asks, skipping gaps he can't help with", () => {
    const gaps = [
      gap("flight:none", "No flight yet."),
      gap("a", "A", "qa"), gap("b", "B", "qb"), gap("c", "C", "qc"), gap("d", "D", "qd"),
    ];
    const tip = bentoManTip({ gaps, dismissed: [], coveredNights: 5, totalNights: 5 }, { welcome: false });
    expect(tip.tip).toBe("No flight yet.");
    expect(tip.asks.map((a) => a.key)).toEqual(["a", "b", "c"]);
  });

  it("welcomes the traveller on the first visit", () => {
    expect(bentoManTip({ gaps: [], dismissed: [], coveredNights: 5, totalNights: 5 }, { welcome: true }).lead).toBe(t.welcome);
  });

  it("says all is covered when nothing is missing", () => {
    expect(bentoManTip({ gaps: [], dismissed: [], coveredNights: 5, totalNights: 5 }, { welcome: false })).toEqual({ lead: null, tip: t.allSet, asks: [] });
  });

  it("never says all is covered when the traveller dismissed what was missing", () => {
    // A real report: two nights in Kyoto, no bed, the gap dismissed.
    const city = { cityId: "kyoto", name: "Kyoto", nights: 2, sortOrder: 0, arriveDate: "2026-11-20", departDate: "2026-11-22" };
    const all = detectGaps({ startDate: "2026-11-20", endDate: "2026-11-22", cities: [city], bookings: [], places: [], today: "2026-09-16", dismissed: new Set() });
    const report = detectGaps({ startDate: "2026-11-20", endDate: "2026-11-22", cities: [city], bookings: [], places: [], today: "2026-09-16", dismissed: new Set(all.gaps.map((g) => g.key)) });
    expect(report.gaps).toEqual([]);
    const tip = bentoManTip(report, { welcome: false });
    expect(tip.tip).not.toBe(t.allSet);
    expect(tip.tip).toBe(t.setAside);
  });

  it("asks for dates when there are no nights yet", () => {
    expect(bentoManTip({ gaps: [], dismissed: [], coveredNights: 0, totalNights: 0 }, { welcome: false }).tip).toBe(t.noDates);
  });
});
