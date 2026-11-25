import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed/kansai-sanyo";
import { copy } from "@/copy";
import { travelFromGraph } from "../travel";
import { fitPlace, fitUnchecked, type FitInput } from "../fit";
import { kyoto, owner } from "../__fixtures__/kyoto";
import type { PlaceInput } from "../types";

const travel = travelFromGraph(buildGraph(stations, edges));
const byId = new Map(kyoto.map((p) => [p.id, p]));
const P = (id: string) => byId.get(id)!;
// Monday 23 November 2026.
const MONDAY = "2026-11-23";
const TUESDAY = "2026-11-24";

const stop = (id: string, durationMin = P(id).durationTypicalMin ?? 60) => ({ placeId: id, durationMin, locked: false, startMin: null });

function input(place: PlaceInput, over: Partial<FitInput> = {}): FitInput {
  const extra = [place, ...(over.places ? [...over.places.values()] : [])];
  return {
    date: TUESDAY,
    place,
    items: [],
    places: new Map([...kyoto, ...extra].map((p) => [p.id, p])),
    travel,
    traveller: owner,
    dayStartMin: 9 * 60,
    ...over,
    ...(over.places ? { places: new Map([...kyoto, ...extra].map((p) => [p.id, p])) } : {}),
  };
}

const terms = (r: ReturnType<typeof fitPlace>) => r.problems.map((x) => x.term);

describe("fitPlace: a place the traveller adds by hand", () => {
  it("fits: no problems, and the praise is the engine's own clauses", () => {
    const r = fitPlace(input(P("kyt-sanjusangendo"), { items: [stop("kyt-fushimi-inari"), stop("kyt-kiyomizu")] }));
    expect(r.fits).toBe(true);
    expect(r.problems).toEqual([]);
    // The owner likes shrines and history: scorePlace's own clause.
    expect(r.praise).toContain(copy.plan.reasons.matches("shrines & temples and history & castles"));
    expect(r.startMin).toBeGreaterThanOrEqual(9 * 60);
    expect(r.endMin - r.startMin).toBe(50);
    // What it would store on the stop is buildReason's sentence.
    expect(r.reason.reason).toMatch(/^Matches shrines/);
  });

  it("closed that day: the filter's own words", () => {
    const r = fitPlace(input(P("kyt-national-museum"), { date: MONDAY }));
    expect(r.fits).toBe(false);
    expect(r.problems).toContainEqual({ term: "closed", text: copy.plan.leftOut.closed("Monday") });
  });

  it("closed on a date it closes every year", () => {
    const museum = { ...P("kyt-national-museum"), closedYearly: ["12-28..01-01"] };
    const r = fitPlace(input(museum, { date: "2026-12-30" }));
    expect(terms(r)).toContain("closed");
  });

  it("over the day: says by how much, from the re-timed day", () => {
    const items = [stop("kyt-fushimi-inari", 150), stop("kyt-kiyomizu", 120), stop("kyt-ninenzaka", 120)];
    const r = fitPlace(input(P("kyt-nijo-castle"), { items, dayStartMin: 7 * 60 }));
    expect(r.fits).toBe(false);
    const over = r.problems.find((x) => x.term === "over_day");
    expect(over).toBeDefined();
    expect(over!.text).toBe(copy.plan.fit.overDay(copy.time.duration(r.overByAfter), copy.time.duration(r.budgetMin)));
    expect(r.overByAfter).toBeGreaterThan(0);
  });

  it("after closing: the visit would run past its closing time", () => {
    const r = fitPlace(input(P("kyt-tofukuji"), { dayStartMin: 16 * 60 }));
    expect(r.fits).toBe(false);
    expect(r.problems).toContainEqual({ term: "closes", text: copy.plan.leftOut.closesBefore("16:30", "16:00", 60) });
  });

  it("booking required and not booked; booked, it's fine", () => {
    const r = fitPlace(input(P("kyt-saihoji")));
    expect(r.problems).toContainEqual({ term: "booking_required", text: copy.plan.leftOut.needsTicket(30) });
    const booked = fitPlace(input(P("kyt-saihoji"), { bookedPlaceIds: ["kyt-saihoji"] }));
    expect(terms(booked)).not.toContain("booking_required");
  });

  it("never: an exclude still counts when the traveller adds it", () => {
    const r = fitPlace(input(P("kyt-daimonji-hike")));
    expect(terms(r)).toContain("excluded");
  });

  it("evening-only: not where the day is done hours before its evening", () => {
    const pontocho: PlaceInput = { ...P("kyt-nishiki-market"), id: "kyt-pontocho", name: "Pontocho", eveningOnly: true, opensAt: null, closesAt: null, bestWindow: ["after 17:30"] };
    const early = fitPlace(input(pontocho, { items: [stop("kyt-kiyomizu")] }));
    expect(early.fits).toBe(false);
    expect(early.problems.map((x) => x.term)).toContain("evening");
    // It goes last, held at its evening.
    expect(early.at).toBe(1);
    expect(early.item).toMatchObject({ locked: true, startMin: 17 * 60 + 30 });
    expect(early.startMin).toBe(17 * 60 + 30);

    const late = fitPlace(input(pontocho, { items: [stop("kyt-kiyomizu")], dayStartMin: 15 * 60 + 30 }));
    expect(late.fits).toBe(true);
    expect(late.startMin).toBe(17 * 60 + 30);
    expect(late.praise).toContain(copy.plan.reasons.evening);
  });

  it("the Arashiyama trap: never with Fushimi Inari, said plainly", () => {
    const r = fitPlace(input(P("kyt-arashiyama-bamboo"), { items: [stop("kyt-fushimi-inari")] }));
    expect(r.fits).toBe(false);
    expect(r.problems).toContainEqual({ term: "conflicts_with", text: copy.plan.leftOut.clash("Fushimi Inari Taisha") });
  });

  it("already on another day of the trip", () => {
    const r = fitPlace(input(P("kyt-kiyomizu"), { usedPlaceIds: ["kyt-kiyomizu"] }));
    expect(r.problems).toContainEqual({ term: "already_planned", text: copy.plan.leftOut.alreadyPlanned });
  });

  it("picks a spot that keeps a pin on time over one that makes it late", () => {
    const pinned = { placeId: "kyt-fushimi-inari", durationMin: 90, locked: true, startMin: 9 * 60 };
    const r = fitPlace(input(P("kyt-tofukuji"), { items: [pinned] }));
    expect(r.at).toBe(1);
    expect(terms(r)).not.toContain("pushes_pin");
  });

  it("says when it would make a pin late, if nowhere else works", () => {
    // Pinned at the day's very start and running to closing: before it is
    // too early, after it the museum is shut.
    const pinned = { placeId: "kyt-nishiki-market", durationMin: 470, locked: true, startMin: 10 * 60 };
    const r = fitPlace(input(P("kyt-sanjusangendo"), { items: [pinned], dayStartMin: 10 * 60 }));
    expect(r.fits).toBe(false);
    expect(r.problems.some((x) => x.term === "pushes_pin" || x.term === "closes")).toBe(true);
  });

  it("on your way between two stops, from their positions", () => {
    const at = (p: PlaceInput, lat: number, lon: number): PlaceInput => ({ ...p, lat, lon });
    const a = at(P("kyt-sanjusangendo"), 34.9880, 135.7720);
    const b = at(P("kyt-kiyomizu"), 34.9949, 135.7850);
    const mid = at(P("kyt-ninenzaka"), 34.9915, 135.7785);
    const places = new Map([a, b, mid].map((p) => [p.id, p]));
    const r = fitPlace(input(mid, { items: [stop(a.id), stop(b.id)], places }));
    expect(r.at).toBe(1);
    expect(r.praise).toContain(copy.plan.fit.onTheWay("Sanjusangen-do", "Kiyomizu-dera"));
  });

  it("too far: out of the day's way between its neighbours", () => {
    const at = (p: PlaceInput, lat: number, lon: number): PlaceInput => ({ ...p, lat, lon });
    const a = at(P("kyt-sanjusangendo"), 34.9880, 135.7720);
    const b = at(P("kyt-kiyomizu"), 34.9949, 135.7850);
    // Kinkaku-ji, across town to the north-west.
    const far = at(P("kyt-kinkakuji"), 35.0394, 135.7292);
    const places = new Map([a, b, far].map((p) => [p.id, p]));
    const r = fitPlace(input(far, { items: [stop(a.id), stop(b.id)], places, at: 1 }));
    expect(r.at).toBe(1);
    const km = r.problems.find((x) => x.term === "out_of_way");
    expect(km?.text).toMatch(/^it takes the day \d+\.\d km out of its way between Sanjusangen-do and Kiyomizu-dera$/);
    // At the end of the day it is simply the last stop.
    expect(terms(fitPlace(input(far, { items: [stop(a.id), stop(b.id)], places, at: 2 })))).not.toContain("out_of_way");
  });

  it("a place with no station: says the travel time is a guess", () => {
    const r = fitPlace(input(P("kyt-ginkakuji"), { items: [stop("kyt-sanjusangendo")] }));
    const leg = r.at === 0 ? copy.plan.warnings.noRouteAssumed("Ginkaku-ji", "Sanjusangen-do", 45) : copy.plan.warnings.noRouteAssumed("Sanjusangen-do", "Ginkaku-ji", 45);
    expect(r.notes).toEqual([leg]);
  });
});

describe("fitUnchecked: a free-text stop Bento doesn't know", () => {
  const base = { places: new Map(kyoto.map((p) => [p.id, p])), travel, pace: "standard" as const, dayStartMin: 9 * 60 };

  it("goes at the end, unchecked, held to nothing but the length given", () => {
    const r = fitUnchecked({ ...base, key: "custom:ramen", durationMin: 60, items: [stop("kyt-sanjusangendo"), stop("kyt-kiyomizu")] });
    expect(r.checked).toBe(false);
    expect(r.at).toBe(2);
    expect(r.item).toEqual({ placeId: "custom:ramen", durationMin: 60, locked: false, startMin: null, unchecked: true });
    expect(r.endMin - r.startMin).toBe(60);
    expect(r.problems).toEqual([]);
    // The leg is said to be a guess.
    expect(r.notes).toEqual([copy.plan.warnings.uncheckedLeg(45)]);
  });

  it("still says when its length runs the day over", () => {
    const items = [stop("kyt-fushimi-inari", 150), stop("kyt-kiyomizu", 120), stop("kyt-ninenzaka", 120)];
    const r = fitUnchecked({ ...base, key: "custom:tea", durationMin: 120, items, dayStartMin: 7 * 60 });
    expect(r.problems.map((p) => p.term)).toContain("over_day");
  });

  it("a Bento place beside a free-text stop: the leg is said to be a guess", () => {
    const items = [stop("kyt-sanjusangendo"), { placeId: "custom:ramen", durationMin: 60, locked: false, startMin: null, unchecked: true }];
    const r = fitPlace(input(P("kyt-kiyomizu"), { items, at: 2 }));
    expect(r.notes).toContain(copy.plan.warnings.uncheckedLeg(45));
  });
});
