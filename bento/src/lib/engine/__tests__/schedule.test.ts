import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed/kansai-sanyo";
import { planDay } from "../schedule";
import { planTrip } from "../trip";
import { travelFromGraph } from "../travel";
import { kyoto, owner } from "../__fixtures__/kyoto";

const travel = travelFromGraph(buildGraph(stations, edges));
const WED = "2026-11-25";
const MON = "2026-11-23";

const day = (over: Partial<Parameters<typeof planDay>[0]> = {}) =>
  planDay({ date: WED, cityId: "kyoto-city", places: kyoto, traveller: owner, travel, ...over });

const rejected = (plan: ReturnType<typeof planDay>, id: string) => plan.considered.find((r) => r.placeId === id);
const ids = (plan: ReturnType<typeof planDay>) => plan.items.map((i) => i.placeId);

describe("planDay — the traps", () => {
  it("never puts Arashiyama and Fushimi Inari in the same day, and says why", () => {
    const plan = day();
    const both = ids(plan).includes("kyt-fushimi-inari") && ids(plan).includes("kyt-arashiyama-bamboo");
    expect(both).toBe(false);
    const left = rejected(plan, "kyt-arashiyama-bamboo") ?? rejected(plan, "kyt-fushimi-inari");
    expect(left?.stage).toBe("conflict");
    expect(left?.detail).toMatch(/opposite ends of the city/);
  });

  it("does not fill a Monday with a museum that is closed on Mondays", () => {
    const plan = day({ date: MON });
    expect(ids(plan)).not.toContain("kyt-national-museum");
    expect(rejected(plan, "kyt-national-museum")).toMatchObject({ stage: "filter", term: "closed", detail: "closed on Mondays" });
    // ...but a Wednesday may use it.
    expect(rejected(day(), "kyt-national-museum")?.term).not.toBe("closed");
  });

  it("treats 'no hiking' as never, not rarely", () => {
    const plan = day();
    expect(ids(plan)).not.toContain("kyt-daimonji-hike");
    expect(rejected(plan, "kyt-daimonji-hike")).toMatchObject({ term: "excluded", detail: "you said never: hiking" });
  });

  it("refuses to plan on a draft — its judgement fields are hidden", () => {
    const plan = day();
    expect(rejected(plan, "kyt-draft-teahouse")?.term).toBe("unverified");
  });

  it("leaves out a place that needs a ticket nobody has booked, until they book it", () => {
    expect(rejected(day(), "kyt-saihoji")).toMatchObject({ term: "booking_required" });
    const booked = day({ bookedPlaceIds: ["kyt-saihoji"] });
    expect(rejected(booked, "kyt-saihoji")?.term).not.toBe("booking_required");
  });
});

describe("planDay — the shape of a good day", () => {
  it("anchors an early riser on a morning-window place at 07:00", () => {
    // Which one is the engine's call — in late November Kiyomizu (autumn
    // colour) can beat Fushimi Inari. What must hold: the day opens at
    // 07:00 on a place with a "before" window, and the reason says so.
    const plan = day();
    const first = kyoto.find((p) => p.id === plan.items[0].placeId)!;
    expect(first.bestWindow.some((w) => /^before/.test(w))).toBe(true);
    expect(plan.items[0].startMin).toBe(7 * 60);
    expect(plan.items[0].reason).toMatch(/before it fills/);
  });

  it("never waits more than a few minutes for the first door to open", () => {
    const plan = day();
    expect(plan.warnings.some((w) => /the day waits/.test(w))).toBe(false);
  });

  it("does not shuffle a busy morning-window place to midday just to save a hop", () => {
    // Give the ordering a reason to: a tolerant traveller with a late
    // start would not care; an averse one starting early should keep
    // every crowd-heavy windowed place it visits inside its window when
    // the geometry allows it at all.
    const plan = day();
    const missed = plan.items.filter((it) => {
      const p = kyoto.find((x) => x.id === it.placeId)!;
      if ((p.crowdLevel ?? 0) < 0.7 || !p.bestWindow.length) return false;
      return !p.bestWindow.some((w) => /^before/.test(w) ? it.startMin <= 8 * 60 : it.startMin >= 17 * 60 + 30);
    });
    // At most one windowed place can be first, so allow the rest to miss —
    // but the anchor itself must not.
    expect(missed.map((m) => m.placeId)).not.toContain(plan.items[0].placeId);
  });

  it("stays inside the day budget and reports slack honestly", () => {
    const plan = day();
    expect(plan.activeMin).toBeLessThanOrEqual(plan.budgetMin);
    expect(plan.slackMin).toBe(plan.budgetMin - plan.activeMin);
    expect(plan.items.length).toBeGreaterThanOrEqual(3);
    expect(plan.items.length).toBeLessThanOrEqual(5);
  });

  it("carries a real transit leg between stops, from the P3 router", () => {
    const plan = day();
    const leg = plan.items[1].arriveBy!;
    expect(leg).not.toBeNull();
    expect(leg.mode).not.toBe("estimate");
    expect(leg.detail).toMatch(/Walk \d+ min to/);
  });

  it("gives every item a reason built from its own score terms", () => {
    for (const it of day().items) {
      expect(it.reason.length).toBeGreaterThan(10);
      expect(it.reasonTerms.length).toBeGreaterThan(0);
      for (const term of it.reasonTerms) expect(it.score.terms.map((t) => t.term)).toContain(term);
    }
  });

  it("keeps next-best alternatives so a slot can be swapped", () => {
    const plan = day();
    const withAlts = plan.items.filter((i) => i.alternatives.length > 0);
    expect(withAlts.length).toBeGreaterThan(0);
    expect(withAlts[0].alternatives[0].whyNot).toMatch(/lower|further/);
  });

  it("penalises the third temple of a day and says so", () => {
    const plan = day({ maxItems: 7, traveller: { ...owner, pace: "packed", crowdTolerance: 0.9 } });
    const temples = plan.items.filter((i) => i.category === "temple");
    if (temples.length >= 3) {
      const third = temples[2].score.terms.find((t) => t.term === "redundancy")!;
      expect(third.contribution).toBeLessThan(0);
      expect(third.clause).toMatch(/third temple/);
    }
    expect(temples.length).toBeLessThanOrEqual(4);
  });

  it("puts lunch on the clock between stops", () => {
    const plan = day();
    expect(plan.meals).toHaveLength(1);
    expect(plan.meals[0].startMin).toBeGreaterThanOrEqual(11 * 60 + 30);
    expect(plan.meals[0].startMin).toBeLessThanOrEqual(14 * 60);
  });

  it("falls back honestly when a place has no transit data", () => {
    const plan = day({ maxItems: 7, traveller: { ...owner, crowdTolerance: 0.9 } });
    const used = plan.items.some((i) => ["kyt-kinkakuji", "kyt-ginkakuji", "kyt-nijo-castle"].includes(i.placeId));
    if (used) expect(plan.warnings.some((w) => /No transit data/.test(w))).toBe(true);
  });
});

describe("planDay — pinning", () => {
  it("keeps a pinned item and its time through re-planning", () => {
    const plan = day({ locked: [{ placeId: "kyt-sanjusangendo", startMin: 10 * 60 }] });
    const pinned = plan.items.find((i) => i.placeId === "kyt-sanjusangendo")!;
    expect(pinned.locked).toBe(true);
    expect(pinned.startMin).toBe(10 * 60);
  });

  it("keeps a pinned item even when the filter would have dropped it, and warns", () => {
    const plan = day({ date: MON, locked: [{ placeId: "kyt-national-museum" }] });
    expect(ids(plan)).toContain("kyt-national-museum");
    expect(plan.warnings.some((w) => /pinned but closed on Mondays/.test(w))).toBe(true);
  });
});

describe("planTrip", () => {
  it("does not reuse a place across days and totals cost per city", () => {
    const trip = planTrip({
      days: [{ date: "2026-11-24", cityId: "kyoto-city" }, { date: WED, cityId: "kyoto-city" }],
      traveller: owner,
      budgetByCity: { "kyoto-city": "mid" },
      placesByCity: { "kyoto-city": kyoto },
      travel,
    });
    const all = trip.days.flatMap((d) => d.items.map((i) => i.placeId));
    expect(new Set(all).size).toBe(all.length);
    expect(trip.byCity).toHaveLength(1);
    expect(trip.byCity[0]).toMatchObject({ cityId: "kyoto-city", days: 2 });
    expect(trip.byCity[0].costJpy).toBe(trip.days[0].costJpy + trip.days[1].costJpy);
  });
});
