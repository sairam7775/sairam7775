import { describe, expect, it } from "vitest";
import { buildReason, chooseDuration, scorePlace } from "../score";
import { kyoto, owner } from "../__fixtures__/kyoto";

const p = (id: string) => kyoto.find((x) => x.id === id)!;
const ctx = (over: Partial<{ counts: [string, number][]; remaining: number; month: number }> = {}) => ({
  categoryCounts: new Map(over.counts ?? []),
  remainingMin: over.remaining ?? 480,
  month: over.month ?? 11,
});

describe("scorePlace", () => {
  it("rewards interest overlap and a first-timer signature", () => {
    const s = scorePlace(p("kyt-fushimi-inari"), owner, ctx());
    const t = Object.fromEntries(s.terms.map((x) => [x.term, x]));
    // Dice: 2 matched of (2 place tags + 3 traveller tags). A one-tag place
    // can no longer score a perfect match by being narrow.
    expect(t.interest_match.value).toBeCloseTo(0.8);
    expect(t.signature.clause).toMatch(/regret missing/);
  });

  it("penalises crowds in proportion to how little the traveller tolerates them", () => {
    const tolerant = scorePlace(p("kyt-kiyomizu"), { ...owner, crowdTolerance: 0.9 }, ctx());
    const averse = scorePlace(p("kyt-kiyomizu"), owner, ctx());
    const c = (s: typeof averse) => s.terms.find((x) => x.term === "crowd")!.contribution;
    expect(c(averse)).toBeLessThan(c(tolerant));
  });

  it("makes the fourth of a category worth less than the first", () => {
    const first = scorePlace(p("kyt-tofukuji"), owner, ctx()).total;
    const fourth = scorePlace(p("kyt-tofukuji"), owner, ctx({ counts: [["temple", 3]] })).total;
    expect(fourth).toBeLessThan(first);
  });

  it("knows what is in season", () => {
    const nov = scorePlace(p("kyt-tofukuji"), owner, ctx({ month: 11 })).terms.find((x) => x.term === "season_fit")!;
    const jul = scorePlace(p("kyt-tofukuji"), owner, ctx({ month: 7 })).terms.find((x) => x.term === "season_fit")!;
    expect(nov.value).toBe(1);
    expect(nov.clause).toMatch(/autumn colour/);
    expect(jul.value).toBeLessThan(nov.value);
  });

  it("strains the budget only past the band's threshold", () => {
    const cheap = scorePlace(p("kyt-sanjusangendo"), owner, ctx()).terms.find((x) => x.term === "budget_strain")!;
    const dear = scorePlace(p("kyt-saihoji"), { ...owner, budgetBand: "budget" }, ctx()).terms.find((x) => x.term === "budget_strain")!;
    expect(cheap.value).toBe(0);
    expect(dear.value).toBeGreaterThan(0);
    expect(dear.clause).toMatch(/¥4,000/);
  });
});

describe("chooseDuration", () => {
  it("shortens for a packed pace and lengthens for a relaxed one", () => {
    const f = p("kyt-fushimi-inari");
    expect(chooseDuration(f, "packed")).toBe(45);
    expect(chooseDuration(f, "standard")).toBe(90);
    expect(chooseDuration(f, "relaxed")).toBe(180);
  });
  it("returns null for a draft, whose durations are hidden", () => {
    expect(chooseDuration(p("kyt-draft-teahouse"), "standard")).toBeNull();
  });
});

describe("buildReason", () => {
  it("writes a sentence from the strongest clauses and reports which terms it used", () => {
    const s = scorePlace(p("kyt-fushimi-inari"), owner, ctx());
    const { reason, terms } = buildReason(s, ["starting 07:00, before it fills"]);
    expect(reason).toMatch(/^Matches shrines & temples and nature & landscape; /);
    expect(reason).toMatch(/before it fills\.$/);
    expect(terms).toContain("interest_match");
  });
});
