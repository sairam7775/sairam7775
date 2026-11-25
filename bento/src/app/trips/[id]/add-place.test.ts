/** "Add a place" on the day box: the server action checks the place in the
 *  engine and adds it, or says why not and adds it only when asked again. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { copy } from "@/copy";
import { MemoryStore } from "@/lib/bento-man/store.memory";
import { runTool, type ToolContext } from "@/lib/bento-man/tools";
import { OutcomeUnknownError, type DayRow } from "@/lib/bento-man/store";

const mocks = vi.hoisted(() => ({ store: null as unknown, user: { id: "u1" } as { id: string } | null }));

vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: mocks.user } }) } }),
}));
vi.mock("@/lib/bento-man/store.supabase", () => ({
  SupabaseStore: function SupabaseStore() { return mocks.store; },
}));

import { addCustomStop, addPlaceToDay, placesForDay, replanDayAction } from "./day-actions";
import { savedStopWarnings } from "@/lib/trips/stop-warnings";

const TRIP = "11111111-1111-4111-8111-111111111111";
// Tuesday 24 November 2026, a Kyoto day.
const DAY = "2026-11-24";
const ad = copy.day.addPlace;

async function tripWith(placeIds: string[]): Promise<MemoryStore> {
  const store = new MemoryStore({ trip: { startDate: "2026-11-20", endDate: "2026-11-29" }, cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }] });
  const ctx: ToolContext = { store, today: "2026-09-15", proposal: null };
  await runTool("plan_days", { dates: [{ date: DAY }] }, ctx);
  await store.applyProposal(ctx.proposal!);
  const day = (await store.state()).days.find((d) => d.date === DAY)!;
  const template = day.items[0];
  const items = placeIds.map((placeId, i) => ({ ...template, placeId, name: placeId, sortOrder: i, locked: false, durationMin: 60, startMin: i === 0 ? 9 * 60 : null, reason: null, reasonTerms: [] }));
  await store.saveDay({ ...day, items });
  return store;
}

const dayOf = async (store: MemoryStore, date = DAY): Promise<DayRow> => (await store.state()).days.find((d) => d.date === date)!;

beforeEach(() => {
  mocks.store = null;
  mocks.user = { id: "u1" };
});

describe("addPlaceToDay: validation and ownership", () => {
  it("refuses a malformed request without reading anything", async () => {
    expect(await addPlaceToDay({ tripId: "not-a-trip", date: DAY, placeId: "kyt-gion" })).toEqual({ status: "error", error: ad.errors.badInput });
    expect(await addPlaceToDay({ tripId: TRIP, date: "24/11/2026", placeId: "kyt-gion" })).toEqual({ status: "error", error: ad.errors.badInput });
    expect(await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "" })).toEqual({ status: "error", error: ad.errors.badInput });
  });

  it("refuses when nobody is signed in", async () => {
    mocks.user = null;
    expect(await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-gion" })).toEqual({ status: "error", error: ad.errors.signedOut });
    expect(await placesForDay({ tripId: TRIP, date: DAY })).toEqual({ error: ad.errors.signedOut });
  });

  it("someone else's trip: RLS shows no trip, and nothing is written", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    vi.spyOn(store, "state").mockRejectedValue(new Error("trip not found"));
    const save = vi.spyOn(store, "saveDay");
    mocks.store = store;
    expect(await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-gion" })).toEqual({ status: "error", error: ad.errors.failed });
    expect(save).not.toHaveBeenCalled();
  });

  it("only Bento's own verified places in that day's city", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    mocks.store = store;
    // A Hiroshima place on a Kyoto day, and an id that isn't a place.
    expect(await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "hir-peace-park" })).toEqual({ status: "error", error: ad.errors.notHere });
    expect(await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-nowhere" })).toEqual({ status: "error", error: ad.errors.notHere });
    // A draft the gate lets through with its judgement fields empty.
    const places = await store.places("kyoto-city");
    vi.spyOn(store, "places").mockResolvedValue(places.map((p) => (p.id === "kyt-gion" ? { ...p, verificationStatus: "draft" } : p)));
    expect(await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-gion" })).toEqual({ status: "error", error: ad.errors.notHere });
  });

  it("not twice on one day", async () => {
    mocks.store = await tripWith(["kyt-nanzenji"]);
    const r = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-nanzenji" });
    expect(r.status).toBe("error");
  });

  it("a date that isn't a day of the trip", async () => {
    mocks.store = await tripWith(["kyt-nanzenji"]);
    expect(await addPlaceToDay({ tripId: TRIP, date: "2026-12-30", placeId: "kyt-gion" })).toEqual({ status: "error", error: ad.errors.notADay });
  });
});

describe("addPlaceToDay: it fits", () => {
  it("adds it at the spot the engine found, re-timed, and says why it's a good pick", async () => {
    const store = await tripWith(["kyt-nanzenji", "kyt-gion"]);
    mocks.store = store;
    const r = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-philosophers-path" });
    expect(r.status).toBe("added");
    if (r.status !== "added") return;
    expect(r.fits).toBe(true);
    expect(r.problems).toEqual([]);
    const day = await dayOf(store);
    // The engine's best spot: the path first, walking down to Nanzen-ji and
    // on to Gion. The traveller's own two stops keep their order.
    expect(day.items.map((i) => i.placeId)).toEqual(["kyt-philosophers-path", "kyt-nanzenji", "kyt-gion"]);
    // Re-timed by retimeDay: every stop has a start, in order.
    const starts = day.items.map((i) => i.startMin!);
    expect(starts.every((s, i) => i === 0 || s > starts[i - 1])).toBe(true);
    expect(r.startMin).toBe(day.items[0].startMin);
    expect(day.items[1].arriveDetail).toBeTruthy();
    // Praise only from the engine's clause lists.
    const known = Object.values(copy.plan.reasons).filter((x) => typeof x === "string");
    for (const p of r.praise) {
      const fromEngine = known.includes(p) || /^matches |^it's on your way between |^\d+ min on foot from |^starting \d\d:\d\d, before it fills$|^after \d\d:\d\d, when it empties out$|^usually at its best around now/.test(p);
      expect(fromEngine, p).toBe(true);
    }
  });

  it("on an empty route day with nothing saved yet", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    mocks.store = store;
    const r = await addPlaceToDay({ tripId: TRIP, date: "2026-11-25", placeId: "kyt-gion" });
    expect(r.status).toBe("added");
    expect((await dayOf(store, "2026-11-25")).items.map((i) => i.placeId)).toEqual(["kyt-gion"]);
  });
});

describe("addPlaceToDay: it doesn't fit", () => {
  it("closed that day: says why and adds nothing; asked again, adds it", async () => {
    const store = await tripWith(["kyt-nanzenji", "kyt-gion"]);
    const places = await store.places("kyoto-city");
    vi.spyOn(store, "places").mockResolvedValue(places.map((p) => (p.id === "kyt-philosophers-path" ? { ...p, closedWeekdays: [2] } : p)));
    mocks.store = store;
    const save = vi.spyOn(store, "saveDay");

    const first = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-philosophers-path" });
    expect(first.status).toBe("doesnt-fit");
    if (first.status !== "doesnt-fit") return;
    expect(first.problems).toContainEqual({ term: "closed", text: copy.plan.leftOut.closed("Tuesday") });
    expect(save).not.toHaveBeenCalled();

    const again = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-philosophers-path", anyway: true });
    expect(again.status).toBe("added");
    if (again.status !== "added") return;
    expect(again.fits).toBe(false);
    expect(again.praise).toEqual([]);
    expect(again.problems.map((p) => p.term)).toContain("closed");
    expect((await dayOf(store)).items.map((i) => i.placeId)).toContain("kyt-philosophers-path");
  });

  it("the Arashiyama trap: refuses beside Fushimi Inari, in the planner's words", async () => {
    mocks.store = await tripWith(["kyt-fushimi-inari"]);
    const r = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-togetsukyo" });
    expect(r.status).toBe("doesnt-fit");
    if (r.status !== "doesnt-fit") return;
    expect(r.problems.find((p) => p.term === "conflicts_with")?.text).toMatch(/^can't share a day with Fushimi Inari/);
  });

  it("an over-full day: says by how much; anyway, it goes in", async () => {
    const store = await tripWith(["kyt-nanzenji", "kyt-philosophers-path", "kyt-shorenin", "kyt-yasaka-shrine", "kyt-gion", "kyt-kamogawa", "kyt-nijo-castle"]);
    mocks.store = store;
    const r = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-kinkakuji" });
    expect(r.status).toBe("doesnt-fit");
    if (r.status !== "doesnt-fit") return;
    expect(r.problems.map((p) => p.term)).toContain("over_day");
    const anyway = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-kinkakuji", anyway: true });
    expect(anyway.status).toBe("added");
    expect((await dayOf(store)).items).toHaveLength(8);
  });
});

describe("placesForDay", () => {
  it("lists the day's city's verified places, marking the ones already on the day", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    const places = await store.places("kyoto-city");
    vi.spyOn(store, "places").mockResolvedValue(places.map((p) => (p.id === "kyt-gion" ? { ...p, verificationStatus: "draft" } : p)));
    mocks.store = store;
    const r = await placesForDay({ tripId: TRIP, date: DAY });
    if (!("places" in r)) throw new Error(r.error);
    expect(r.places.length).toBeGreaterThan(10);
    expect(r.places.every((p) => p.id.startsWith("kyt-"))).toBe(true);
    expect(r.places.find((p) => p.id === "kyt-gion")).toBeUndefined();
    expect(r.places.find((p) => p.id === "kyt-nanzenji")?.onDay).toBe(true);
  });
});

describe("copy: the compliment and the refusal are the engine's words", () => {
  it("a compliment only when the engine gave a reason, made of those reasons", () => {
    const praise = [copy.plan.fit.onTheWay("Nanzen-ji", "Gion"), copy.plan.reasons.matches("history & castles")];
    expect(ad.fits("Shoren-in", "11:20", praise)).toBe("Good call. It's on your way between Nanzen-ji and Gion; matches history & castles. Shoren-in goes in at 11:20.");
    // Nothing true to praise: no compliment, just the fact.
    expect(ad.fits("Shoren-in", "11:20", [])).toBe("Shoren-in fits. It goes in at 11:20.");
  });

  it("no filler: no exclamation marks or emoji anywhere in the sheet", () => {
    const lines = [ad.fits("A", "10:00", ["x"]), ad.doesntFit("A"), ad.anywayNote, ad.addedAnyway("A", "10:00"), ad.intro("Kyoto"), ...Object.values(copy.plan.fit).map((f) => (f as (...a: string[]) => string)("A", "B", "1.0"))];
    for (const l of lines) expect(l).not.toMatch(/!|\p{Extended_Pictographic}/u);
  });
});

describe("addCustomStop: a place Bento doesn't know", () => {
  it("validates the name and the length", async () => {
    mocks.store = await tripWith(["kyt-nanzenji"]);
    for (const bad of [
      { name: "", durationMin: 60 },
      { name: "x".repeat(81), durationMin: 60 },
      { name: "!!!", durationMin: 60 },
      { name: "Bar\u0007", durationMin: 60 },
      { name: "Ramen", durationMin: 2 },
      { name: "Ramen", durationMin: 721 },
      { name: "Ramen", durationMin: 30.5 },
    ]) {
      expect(await addCustomStop({ tripId: TRIP, date: DAY, ...bad }), JSON.stringify(bad)).toEqual({ status: "error", error: ad.errors.badInput });
    }
  });

  it("refuses when nobody is signed in, and on someone else's trip writes nothing", async () => {
    mocks.user = null;
    expect(await addCustomStop({ tripId: TRIP, date: DAY, name: "Ramen", durationMin: 60 })).toEqual({ status: "error", error: ad.errors.signedOut });
    mocks.user = { id: "u1" };
    const store = await tripWith(["kyt-nanzenji"]);
    vi.spyOn(store, "state").mockRejectedValue(new Error("trip not found"));
    const save = vi.spyOn(store, "saveDay");
    mocks.store = store;
    expect(await addCustomStop({ tripId: TRIP, date: DAY, name: "Ramen", durationMin: 60 })).toEqual({ status: "error", error: ad.errors.failed });
    expect(save).not.toHaveBeenCalled();
  });

  it("adds it at the end, unchecked, for the length given, with guessed legs", async () => {
    const store = await tripWith(["kyt-nanzenji", "kyt-gion"]);
    mocks.store = store;
    const r = await addCustomStop({ tripId: TRIP, date: DAY, name: "  Ramen   Ichiran ", durationMin: 90 });
    expect(r.status).toBe("added");
    if (r.status !== "added") return;
    expect(r.name).toBe("Ramen Ichiran");
    const day = await dayOf(store);
    const last = day.items[day.items.length - 1];
    expect(last).toMatchObject({ placeId: "custom:ramen-ichiran", customName: "Ramen Ichiran", name: "Ramen Ichiran", durationMin: 90, arriveMode: "estimate", arriveMinutes: 45 });
    expect(r.startMin).toBe(last.startMin);
    expect(r.notes).toEqual([copy.plan.warnings.uncheckedLeg(45)]);
    // Once a day per name.
    expect(await addCustomStop({ tripId: TRIP, date: DAY, name: "ramen ichiran", durationMin: 60 })).toEqual({ status: "error", error: ad.errors.alreadyHere("ramen ichiran") });
  });

  it("a Bento place added after it takes a guessed leg from it, not a train from the stop before", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    mocks.store = store;
    await addCustomStop({ tripId: TRIP, date: DAY, name: "Ramen", durationMin: 60 });
    const r = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-gion", anyway: true });
    expect(r.status).toBe("added");
    const day = await dayOf(store);
    const ramen = day.items.findIndex((i) => i.placeId === "custom:ramen");
    // Both legs touching the free-text stop are the guess, wherever Gion went.
    expect(day.items[ramen].arriveMode).toBe("estimate");
    if (ramen + 1 < day.items.length) expect(day.items[ramen + 1].arriveMode).toBe("estimate");
    expect(day.items.filter((i) => i.arriveMode === "estimate")).toHaveLength(ramen + 1 < day.items.length ? 2 : 1);
  });

  it("a re-plan never errors on one: it is left to the proposal, which shows it out", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    mocks.store = store;
    await addCustomStop({ tripId: TRIP, date: DAY, name: "Ramen", durationMin: 60 });
    const day = await dayOf(store);
    await store.saveDay({ ...day, items: day.items.map((i) => ({ ...i, locked: true })) });
    const append = vi.spyOn(store, "append");
    const form = new FormData();
    form.set("tripId", TRIP);
    form.set("date", DAY);
    const thrown = await replanDayAction(form).then(() => "", (e: Error) => e.message);
    expect(thrown).not.toMatch(/error=/);
    const diff = append.mock.calls[0][2]!.days![0];
    expect(diff.removed.map((x) => x.name)).toContain("Ramen");
    expect(diff.warnings.join(" ")).not.toMatch(/custom:/);
  });
});

describe("two edits at once (review F1)", () => {
  /** Another write lands between this action's read and its own write. */
  function raceOnce(store: MemoryStore, other: (day: DayRow) => DayRow) {
    const save = store.saveDay.bind(store);
    let raced = false;
    vi.spyOn(store, "saveDay").mockImplementation(async (day, expect) => {
      if (!raced) {
        raced = true;
        const now = (await store.state()).days.find((d) => d.date === day.date)!;
        await save(other(now));
      }
      return save(day, expect);
    });
  }
  const withStop = (placeId: string, name = placeId) => (d: DayRow): DayRow => ({ ...d, items: [...d.items, { ...d.items[0], placeId, name, customName: placeId.startsWith("custom:") ? name : undefined, sortOrder: d.items.length }] });

  it("an add worked out from a day that changed meanwhile adds nothing and says so; the other edit stays", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    mocks.store = store;
    raceOnce(store, withStop("kyt-gion"));
    const r = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-philosophers-path" });
    expect(r).toEqual({ status: "error", error: ad.errors.dayChanged });
    expect((await dayOf(store)).items.map((i) => i.placeId)).toEqual(["kyt-nanzenji", "kyt-gion"]);
  });

  it("the same for a free-text stop", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    mocks.store = store;
    raceOnce(store, withStop("custom:tea", "Tea"));
    const r = await addCustomStop({ tripId: TRIP, date: DAY, name: "Ramen", durationMin: 60 });
    expect(r).toEqual({ status: "error", error: ad.errors.dayChanged });
    expect((await dayOf(store)).items.map((i) => i.placeId)).toEqual(["kyt-nanzenji", "custom:tea"]);
  });

  it("a write that timed out says it can't confirm, not that nothing changed", async () => {
    const store = await tripWith(["kyt-nanzenji"]);
    mocks.store = store;
    vi.spyOn(store, "saveDay").mockRejectedValue(new OutcomeUnknownError(copy.day.saveUnknown));
    expect(await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-gion" })).toEqual({ status: "error", error: copy.day.saveUnknown });
    expect(await addCustomStop({ tripId: TRIP, date: DAY, name: "Ramen", durationMin: 60 })).toEqual({ status: "error", error: copy.day.saveUnknown });
  });
});

describe("after the sheet closes (review F9)", () => {
  it("a stop added anyway keeps saying what's off when the page is read again", async () => {
    const store = await tripWith(["kyt-nanzenji", "kyt-gion"]);
    const places = await store.places("kyoto-city");
    vi.spyOn(store, "places").mockResolvedValue(places.map((p) => (p.id === "kyt-philosophers-path" ? { ...p, closedWeekdays: [2] } : p)));
    mocks.store = store;
    const added = await addPlaceToDay({ tripId: TRIP, date: DAY, placeId: "kyt-philosophers-path", anyway: true });
    expect(added.status).toBe("added");
    // A fresh read, as the page does on reload.
    const warnings = await savedStopWarnings(store, await store.state(), DAY);
    expect(warnings.get("kyt-philosophers-path")).toEqual([copy.plan.leftOut.closed("Tuesday")]);
    expect(warnings.has("kyt-nanzenji")).toBe(false);
  });
});
