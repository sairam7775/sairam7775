import { describe, expect, it } from "vitest";
import { copy } from "@/copy";
import { bentoManTip } from "../bento-man-tip";
import type { Gap } from "../gaps";

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
    const tip = bentoManTip({ gaps: [gap("bed:1", "Nowhere to sleep on 12 April.", "Where should we stay on 12 April?")], totalNights: 5 }, { welcome: false });
    expect(tip.lead).toBeNull();
    expect(tip.tip).toBe(`Nowhere to sleep on 12 April. ${t.offer}`);
    expect(tip.asks).toEqual([{ key: "bed:1", question: "Where should we stay on 12 April?" }]);
  });

  it("gives at most three quick asks, skipping gaps he can't help with", () => {
    const gaps = [
      gap("flight:none", "No flight yet."),
      gap("a", "A", "qa"), gap("b", "B", "qb"), gap("c", "C", "qc"), gap("d", "D", "qd"),
    ];
    const tip = bentoManTip({ gaps, totalNights: 5 }, { welcome: false });
    expect(tip.tip).toBe("No flight yet.");
    expect(tip.asks.map((a) => a.key)).toEqual(["a", "b", "c"]);
  });

  it("welcomes the traveller on the first visit", () => {
    expect(bentoManTip({ gaps: [], totalNights: 5 }, { welcome: true }).lead).toBe(t.welcome);
  });

  it("says all is covered when nothing is missing", () => {
    expect(bentoManTip({ gaps: [], totalNights: 5 }, { welcome: false })).toEqual({ lead: null, tip: t.allSet, asks: [] });
  });

  it("asks for dates when there are no nights yet", () => {
    expect(bentoManTip({ gaps: [], totalNights: 0 }, { welcome: false }).tip).toBe(t.noDates);
  });
});
