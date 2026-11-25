import { describe, expect, it } from "vitest";
import { buildGraph } from "@/lib/transit/graph";
import { stations, edges } from "@/lib/transit/seed/kansai-sanyo";
import { copy } from "@/copy";
import { travelFromGraph } from "../travel";
import { fitPlace, fitUnchecked, savedDayProblems, type FitInput } from "../fit";
import { kyoto, owner } from "../__fixtures__/kyoto";
import type { PlaceInput } from "../types";
import { daylightEndMin } from "../daylight";
import { dayStats } from "../day-stats";

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

describe("fitPlace: what an insertion does to the stops already there (review)", () => {
  it("F3: pushing an existing hike past its daylight end is a problem", () => {
    const hike = { ...P("kyt-daimonji-hike"), lat: 35.0254, lon: 135.8006 };
    const date = "2026-12-15";
    const dusk = daylightEndMin(hike, date)!;
    const places = new Map([[hike.id, hike]]);
    // After the lunch window, so lunch moves nothing: the hike ends 2 min
    // before its daylight end on its own, and in the dark with a stop first.
    const dayStartMin = 15 * 60 + 1;
    const items = [{ placeId: hike.id, durationMin: dusk - dayStartMin - 2, locked: false, startMin: null }];
    expect(items[0].durationMin).toBeGreaterThan(10);
    const alone = fitPlace(input(P("kyt-sanjusangendo"), { date, items, places, at: 1, dayStartMin, traveller: { ...owner, excludes: [] } }));
    expect(alone.problems.map((p) => p.term)).not.toContain("pushes_dark");
    const r = fitPlace(input(P("kyt-sanjusangendo"), { date, items, places, at: 0, dayStartMin, traveller: { ...owner, excludes: [] } }));
    expect(r.problems.map((p) => p.term)).toContain("pushes_dark");
    expect(r.fits).toBe(false);
  });

  it("F4: pushing the day's last daytime stop past the day's end is a problem", () => {
    const items = [stop("kyt-ninenzaka", 350)];
    const r = fitPlace(input(P("kyt-sanjusangendo"), { items, at: 0, dayStartMin: 12 * 60 }));
    expect(r.problems).toContainEqual({ term: "past_day_end", text: copy.plan.leftOut.pastDayEnd("19:00") });
  });

  it("F5: a pinned free-text stop made late is a problem, by its own name", () => {
    const items = [{ placeId: "custom:lunch", name: "Lunch with Aki", durationMin: 60, locked: true, startMin: 9 * 60, unchecked: true }];
    const r = fitPlace(input(P("kyt-sanjusangendo"), { items, at: 0 }));
    expect(r.problems).toContainEqual({ term: "pushes_pin", text: copy.plan.fit.pushesPin("Lunch with Aki", "09:00") });
  });

  it("F6: a travel day measures the budget less the move, as the day box does", () => {
    const items = [stop("kyt-fushimi-inari", 150), stop("kyt-tofukuji", 120)];
    const moveMin = 180;
    const r = fitPlace(input(P("kyt-sanjusangendo"), { items, moveMin, at: 2 }));
    expect(r.budgetMin).toBe(480 - moveMin);
    expect(r.problems.map((p) => p.term)).toContain("over_day");
    const stored = r.day.items.map((it) => ({ startMin: it.startMin, durationMin: it.durationMin, arriveMinutes: it.arriveBy?.minutes ?? null }));
    expect(dayStats(stored, "standard", moveMin).overBy).toBe(r.overByAfter);
  });

  it("F7: the day's end is checked too: no going back to an area the day left", () => {
    const at = (p: PlaceInput, lat: number, lon: number): PlaceInput => ({ ...p, lat, lon });
    const a = at(P("kyt-sanjusangendo"), 34.9880, 135.7720);
    const far = at(P("kyt-kinkakuji"), 35.0394, 135.7292);
    const back = at(P("kyt-national-museum"), 34.9899, 135.7731);
    const places = new Map([a, far, back].map((p) => [p.id, p]));
    const r = fitPlace(input(back, { items: [stop(a.id), stop(far.id)], places, at: 2 }));
    expect(r.problems).toContainEqual({ term: "out_of_way", text: copy.plan.leftOut.outOfWay });
  });

  it("F7: nor across town before a pin the day opens with", () => {
    const at = (p: PlaceInput, lat: number, lon: number): PlaceInput => ({ ...p, lat, lon });
    const pin = at(P("kyt-kiyomizu"), 34.9949, 135.7850);
    const far = at(P("kyt-nijo-castle"), 35.0142, 135.7482);
    const places = new Map([pin, far].map((p) => [p.id, p]));
    const r = fitPlace(input(far, { items: [{ placeId: pin.id, durationMin: 90, locked: true, startMin: 12 * 60 }], places, at: 0 }));
    expect(r.problems.map((p) => p.term)).toContain("out_of_way");
  });

  it("F11: the reason counts only the stops before it", () => {
    const items = [stop("kyt-tofukuji"), stop("kyt-kiyomizu")];
    const first = fitPlace(input(P("kyt-sanjusangendo"), { items, at: 0 }));
    expect(first.reason.reason).not.toMatch(/third temple/);
    const last = fitPlace(input(P("kyt-sanjusangendo"), { items, at: 2 }));
    expect(last.reason.reason).toMatch(/third temple/);
  });
});

describe("fitUnchecked: what it does to the stops already there (review)", () => {
  it("F5/F6: a pin made late and a travel day's budget count for a free-text stop too", () => {
    const items = [stop("kyt-fushimi-inari", 150), { placeId: "kyt-tofukuji", durationMin: 60, locked: true, startMin: 12 * 60 }];
    const r = fitUnchecked({ places: new Map(kyoto.map((p) => [p.id, p])), travel, pace: "standard", dayStartMin: 9 * 60, key: "custom:x", durationMin: 60, items, moveMin: 300 });
    expect(r.problems.map((p) => p.term)).toContain("over_day");
  });
});

describe("savedDayProblems: what's off about the day as saved (review F9)", () => {
  const saved = (id: string, startMin: number, durationMin = 60) => ({ placeId: id, startMin, durationMin });
  const run = (items: { placeId: string; startMin: number | null; durationMin: number | null; unchecked?: boolean }[], over: { date?: string; places?: Map<string, PlaceInput>; booked?: string[] } = {}) =>
    savedDayProblems({ date: over.date ?? TUESDAY, items, places: over.places ?? byId, traveller: owner, bookedPlaceIds: over.booked });

  it("a stop added anyway on its closed day still says so, by the filter's words", () => {
    expect(run([saved("kyt-national-museum", 600)], { date: MONDAY })).toEqual([[copy.plan.leftOut.closed("Monday")]]);
  });

  it("a needed ticket not held, until one is", () => {
    expect(run([saved("kyt-saihoji", 600)])).toEqual([[copy.plan.leftOut.needsTicket(30)]]);
    expect(run([saved("kyt-saihoji", 600)], { booked: ["kyt-saihoji"] })).toEqual([[]]);
  });

  it("the Arashiyama trap, on both stops", () => {
    const r = run([saved("kyt-fushimi-inari", 420), saved("kyt-arashiyama-bamboo", 600)]);
    expect(r[0]).toContain(copy.plan.leftOut.clash("Arashiyama Bamboo Grove"));
    expect(r[1]).toContain(copy.plan.leftOut.clash("Fushimi Inari Taisha"));
  });

  it("a visit past closing, and an evening place before its evening", () => {
    expect(run([saved("kyt-tofukuji", 16 * 60)])).toEqual([[copy.plan.warnings.closesDuring("Tofuku-ji", "16:30", "17:00")]]);
    const pontocho: PlaceInput = { ...P("kyt-nishiki-market"), id: "kyt-pontocho", name: "Pontocho", eveningOnly: true, opensAt: null, closesAt: null, bestWindow: ["after 17:30"] };
    expect(run([saved("kyt-pontocho", 15 * 60)], { places: new Map([[pontocho.id, pontocho]]) })).toEqual([[copy.plan.fit.beforeEvening("17:30")]]);
  });

  it("a hike past its daylight end", () => {
    const hike = { ...P("kyt-daimonji-hike"), lat: 35.0254, lon: 135.8006 };
    const dusk = daylightEndMin(hike, "2026-12-15")!;
    const r = savedDayProblems({ date: "2026-12-15", items: [saved(hike.id, dusk - 30, 60)], places: new Map([[hike.id, hike]]), traveller: { ...owner, excludes: [] } });
    expect(r[0][0]).toMatch(/should be finished in daylight/);
  });

  it("nothing for a stop that's fine, or one Bento doesn't know", () => {
    expect(run([saved("kyt-sanjusangendo", 600), { placeId: "custom:ramen", startMin: 720, durationMin: 60, unchecked: true }])).toEqual([[], []]);
  });
});

describe("re-check (review round 2)", () => {
  it("F3: a hike already past its daylight end that gets later still is a problem", () => {
    const hike = { ...P("kyt-daimonji-hike"), lat: 35.0254, lon: 135.8006 };
    const date = "2026-12-15";
    const dusk = daylightEndMin(hike, date)!;
    const dayStartMin = 15 * 60 + 1;
    // Already 10 min past daylight on its own.
    const items = [{ placeId: hike.id, durationMin: dusk - dayStartMin + 10, locked: false, startMin: null }];
    const r = fitPlace(input(P("kyt-sanjusangendo"), { date, items, places: new Map([[hike.id, hike]]), at: 0, dayStartMin, traveller: { ...owner, excludes: [] } }));
    expect(r.problems.map((p) => p.term)).toContain("pushes_dark");
  });

  it("F3: the same for a stop already past closing that would run later", () => {
    const items = [stop("kyt-tofukuji", 60)];
    const r = fitPlace(input(P("kyt-sanjusangendo"), { items, at: 0, dayStartMin: 16 * 60 }));
    expect(r.problems.map((p) => p.term)).toContain("pushes_closing");
  });

  it("#12: an evening place may end the day back where it began, as the planner allows", () => {
    const at = (p: PlaceInput, lat: number, lon: number): PlaceInput => ({ ...p, lat, lon });
    const a = at(P("kyt-sanjusangendo"), 34.9880, 135.7720);
    const far = at(P("kyt-kinkakuji"), 35.0394, 135.7292);
    const dinner = at({ ...P("kyt-nishiki-market"), id: "kyt-pontocho", name: "Pontocho", eveningOnly: true, opensAt: null, closesAt: null, bestWindow: ["after 17:30"] }, 34.9899, 135.7731);
    const places = new Map([a, far, dinner].map((p) => [p.id, p]));
    const r = fitPlace(input(dinner, { items: [stop(a.id), stop(far.id)], places, dayStartMin: 13 * 60 }));
    expect(r.problems.map((p) => p.term)).not.toContain("out_of_way");
    // A daytime place there still strays (F7).
    const back = at(P("kyt-national-museum"), 34.9899, 135.7731);
    const day = fitPlace(input(back, { items: [stop(a.id), stop(far.id)], places: new Map([a, far, back].map((p) => [p.id, p])), at: 2 }));
    expect(day.problems.map((p) => p.term)).toContain("out_of_way");
  });

  it("F9: a saved daytime stop ending after the day's end says so; an evening one doesn't", () => {
    const pontocho: PlaceInput = { ...P("kyt-nishiki-market"), id: "kyt-pontocho", name: "Pontocho", eveningOnly: true, opensAt: null, closesAt: null, bestWindow: ["after 17:30"] };
    const places = new Map([...byId, [pontocho.id, pontocho]]);
    // Standard pace from 09:00: the day's end is 18:00.
    const r = savedDayProblems({ date: TUESDAY, places, traveller: owner, items: [
      { placeId: "kyt-ninenzaka", startMin: 9 * 60, durationMin: 60 },
      { placeId: "kyt-gion-x", startMin: 12 * 60, durationMin: 60 },
      { placeId: "kyt-ninenzaka", startMin: 17 * 60 + 30, durationMin: 60 },
      { placeId: "kyt-pontocho", startMin: 18 * 60, durationMin: 90 },
    ] });
    expect(r[2]).toContain(copy.plan.leftOut.pastDayEnd("18:00"));
    expect(r[0]).toEqual([]);
    expect(r[3]).toEqual([]);
    // A travel day ends as any day: the move doesn't move the end earlier here.
    expect(savedDayProblems({ date: TUESDAY, places, traveller: owner, moveMin: 90, items: [{ placeId: "kyt-ninenzaka", startMin: 9 * 60, durationMin: 60 }] })).toEqual([[]]);
  });
});
