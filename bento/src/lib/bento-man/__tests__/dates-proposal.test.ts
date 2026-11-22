/** #6: moving a trip's dates is a proposal the traveller accepts, unless
 *  they said Bento Man may change dates without asking. Anything proposed
 *  in the same turn is planned on the new dates and accepted with them. */
import { describe, expect, it } from "vitest";
import { MemoryStore, type MemorySetup } from "../store.memory";
import { runTool, type ToolContext } from "../tools";
import { datesDiff, describeDates, mergeProposals, parseProposal } from "../diff";
import { buildContext } from "../context";
import { copy } from "@/copy";
import { runBentoMan } from "../chat";
import { ZERO_USAGE } from "../cost";
import type { ModelResult } from "../provider";
import { OutcomeUnknownError } from "../store";

const nov = { title: "Kansai", startDate: "2026-11-20", endDate: "2026-11-29", partySize: 2 };
const routed: MemorySetup = {
  trip: nov,
  cities: [
    { cityId: "osaka-city", nights: 2 },
    { cityId: "kyoto-city", nights: 7 },
  ],
};
const ctxFor = (store: MemoryStore): ToolContext => ({ store, today: "2026-09-15", proposal: null });

describe("set_trip_dates", () => {
  it("proposes a move of existing dates and writes nothing", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    const r = await runTool("set_trip_dates", { start_date: "2026-11-22", end_date: "2026-12-01" }, ctx);
    expect(r.isError).toBeFalsy();
    expect(JSON.parse(r.result)).toMatchObject({ proposed: true, nights: 9 });
    expect(ctx.proposal?.dates).toMatchObject({ before: { startDate: "2026-11-20" }, after: { startDate: "2026-11-22", endDate: "2026-12-01" } });
    expect((await store.state()).trip).toMatchObject(nov);
    expect(parseProposal(ctx.proposal)).not.toBeNull();
  });
  it("says plainly that a proposed move is not applied, and how to word it", async () => {
    // Live, 14 Nov: with "apply without asking" typed into the message, the
    // model read the proposed trip as saved and said the dates had changed.
    const r = JSON.parse((await runTool("set_trip_dates", { start_date: "2026-11-22", end_date: "2026-12-01" }, ctxFor(new MemoryStore(routed)))).result);
    expect(r).toMatchObject({ proposed: true, applied: false, trip_if_accepted: { startDate: "2026-11-22" } });
    expect(r.trip).toBeUndefined();
    expect(r.note).toMatch(/^Not applied/);
    expect(r.note).toMatch(/waiting for their OK/);
    expect(r.note).toMatch(/never say the dates have changed/i);
    expect(r.note).toMatch(/only the trip state/i);
  });

  it("fills in dates an undated trip doesn't have yet at once", async () => {
    const store = new MemoryStore({});
    const ctx = ctxFor(store);
    const r = await runTool("set_trip_dates", { start_date: "2026-11-20", end_date: "2026-11-29" }, ctx);
    expect(JSON.parse(r.result)).toMatchObject({ saved: true });
    expect(ctx.proposal).toBeNull();
    expect((await store.state()).trip).toMatchObject({ startDate: "2026-11-20", endDate: "2026-11-29" });
  });

  it("applies a rename or party size at once", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    await runTool("set_trip_dates", { party_size: 3, title: "Kansai with Mum" }, ctx);
    expect(ctx.proposal).toBeNull();
    expect((await store.state()).trip).toMatchObject({ partySize: 3, title: "Kansai with Mum", startDate: nov.startDate });
  });

  it("moves dates at once for a traveller who allowed it", async () => {
    const store = new MemoryStore({ ...routed, prefs: { autoApplyDates: true } });
    const ctx = ctxFor(store);
    const r = await runTool("set_trip_dates", { start_date: "2026-11-22", end_date: "2026-12-01" }, ctx);
    expect(JSON.parse(r.result)).toMatchObject({ saved: true });
    expect(ctx.proposal).toBeNull();
    expect((await store.state()).trip.startDate).toBe("2026-11-22");
  });

  it("refuses a move that the store would refuse, before proposing", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    const r = await runTool("set_trip_dates", { start_date: "2026-11-20", end_date: "2026-11-23" }, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toContain("9 nights");
    expect(ctx.proposal).toBeNull();
  });

  it("refuses to move dates after days were planned this turn", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    await runTool("plan_days", { dates: [{ date: "2026-11-23" }] }, ctx);
    expect(ctx.proposal?.days.length).toBeGreaterThan(0);
    const r = await runTool("set_trip_dates", { start_date: "2026-11-22", end_date: "2026-12-01" }, ctx);
    expect(r.isError).toBe(true);
    expect(ctx.proposal?.dates).toBeUndefined();
  });

  it("plans the rest of the turn on the proposed dates", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    await runTool("set_trip_dates", { start_date: "2026-11-20", end_date: "2026-12-02" }, ctx);
    // 12 nights now: a 12-night route fits the proposed dates, not the stored 9.
    const r = await runTool("propose_route", { cities: [{ city_id: "osaka-city", nights: 3, reason: "Food." }, { city_id: "kyoto-city", nights: 9, reason: "Temples." }] }, ctx);
    expect(r.isError).toBeFalsy();
    expect(ctx.proposal?.route?.after.map((c) => c.nights)).toEqual([3, 9]);
    expect(ctx.proposal?.route?.after.at(-1)?.departDate).toBe("2026-12-02");
    expect(ctx.proposal?.dates?.after.endDate).toBe("2026-12-02");
  });

  it("a second change in the turn keeps the stored trip as 'before'", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    await runTool("set_trip_dates", { start_date: "2026-11-22", end_date: "2026-12-01" }, ctx);
    await runTool("set_trip_dates", { start_date: "2026-11-23", end_date: "2026-12-02" }, ctx);
    expect(ctx.proposal?.dates).toMatchObject({ before: { startDate: "2026-11-20" }, after: { startDate: "2026-11-23" } });
  });
});

describe("accepting a date proposal", () => {
  it("moves the dates, the route and the planned days together", async () => {
    const store = new MemoryStore({ ...routed, days: [{ date: "2026-11-23", cityId: "kyoto-city", items: [] }] });
    const ctx = ctxFor(store);
    await runTool("set_trip_dates", { start_date: "2026-11-22", end_date: "2026-12-01" }, ctx);
    await store.applyProposal(ctx.proposal!);
    const s = await store.state();
    expect(s.trip).toMatchObject({ startDate: "2026-11-22", endDate: "2026-12-01" });
    expect(s.cities[0].arriveDate).toBe("2026-11-22");
    expect(s.days.map((d) => d.date)).toEqual(["2026-11-25"]);
  });

  it("applies a route proposed with the dates on the new dates", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    await runTool("set_trip_dates", { start_date: "2026-11-20", end_date: "2026-12-02" }, ctx);
    await runTool("propose_route", { cities: [{ city_id: "osaka-city", nights: 3, reason: "Food." }, { city_id: "kyoto-city", nights: 9, reason: "Temples." }] }, ctx);
    await store.applyProposal(ctx.proposal!);
    const s = await store.state();
    expect(s.trip.endDate).toBe("2026-12-02");
    expect(s.cities.map((c) => c.nights)).toEqual([3, 9]);
  });

  it("keeps a title or party size changed while the proposal was open", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    await runTool("set_trip_dates", { start_date: "2026-11-22", end_date: "2026-12-01" }, ctx);
    await store.setTripDates({ title: "Kansai with Mum", partySize: 3 });
    await store.applyProposal(ctx.proposal!);
    expect((await store.state()).trip).toMatchObject({ startDate: "2026-11-22", title: "Kansai with Mum", partySize: 3 });
  });

  it("refuses if the trip moved since the proposal was made", async () => {
    const store = new MemoryStore(routed);
    const ctx = ctxFor(store);
    await runTool("set_trip_dates", { start_date: "2026-11-22", end_date: "2026-12-01" }, ctx);
    await store.setTripDates({ startDate: "2026-11-21", endDate: "2026-11-30" });
    await expect(store.applyProposal(ctx.proposal!)).rejects.toThrow(/changed while this was open/);
    expect((await store.state()).trip.startDate).toBe("2026-11-21");
  });
});

describe("the proposal and the trip state", () => {
  it("describes ranges with nights", () => {
    expect(describeDates({ startDate: "2026-11-22", endDate: "2026-12-01" })).toBe("22 Nov – 1 Dec (9 nights)");
    expect(describeDates({ startDate: null, endDate: null })).toBe("no dates");
  });

  it("puts the date change first in the summary", () => {
    const f = { startDate: "2026-11-20", endDate: "2026-11-29", partySize: 2, title: null };
    const p = mergeProposals(null, { summary: "", dates: datesDiff(f, { ...f, startDate: "2026-11-22", endDate: "2026-12-01" }), days: [] });
    expect(mergeProposals(p, { summary: "x", days: [] }).summary).toBe("Dates → 22 Nov – 1 Dec (9 nights)");
  });

  it("tells the model whether date changes need asking", async () => {
    const ask = buildContext(await new MemoryStore(routed).state(), [], "2026-09-15");
    const allowed = buildContext(await new MemoryStore({ ...routed, prefs: { autoApplyDates: true } }).state(), [], "2026-09-15");
    expect(ask).toContain("date changes: proposed for the traveller to accept");
    expect(allowed).toContain("date changes: apply without asking");
  });

  it("set_preferences can't grant the permission, whatever the model sends", async () => {
    const store = new MemoryStore(routed);
    await runTool("set_preferences", { pace: "relaxed", autoApplyDates: true, auto_apply_dates: true, apply_dates_without_asking: true }, ctxFor(store));
    const prefs = (await store.state()).prefs;
    expect(prefs.pace).toBe("relaxed");
    expect(prefs.autoApplyDates).toBe(false);
  });
});

describe("set_trip_dates when the save can't be confirmed", () => {
  /** The database didn't answer in time: the change may or may not have landed. */
  const unconfirmed = () => {
    const store = new MemoryStore({ cities: [] });
    store.setTripDates = async () => { throw new OutcomeUnknownError(copy.plan.dates.outcomeUnknown); };
    return store;
  };

  it("says so to the model instead of an error, and claims neither", async () => {
    const r = await runTool("set_trip_dates", { start_date: "2026-11-20", end_date: "2026-11-29" }, ctxFor(unconfirmed()));
    expect(r.isError).toBeFalsy();
    const out = JSON.parse(r.result);
    expect(out).toMatchObject({ saved: "unknown" });
    expect(out.trip).toBeUndefined();
    expect(out.note).toMatch(/could not confirm/i);
  });

  it("gets no not-changed line on a reply about a change that may have landed", async () => {
    const said = "I've updated your trip dates to 20–29 November.";
    let n = 0;
    const call = async (): Promise<ModelResult> => n++ === 0
      ? { text: "", toolCalls: [{ id: "t1", name: "set_trip_dates", input: { start_date: "2026-11-20", end_date: "2026-11-29" } }], stopReason: "tool_use", usage: { ...ZERO_USAGE }, model: "claude-opus-5" }
      : { text: said, toolCalls: [], stopReason: "end", usage: { ...ZERO_USAGE }, model: "claude-opus-5" };
    const r = await runBentoMan({ store: unconfirmed(), provider: { model: "claude-opus-5", call }, today: "2026-09-15", message: "We go 20 to 29 November." });
    expect(r.text).toBe(said);
    expect(r.text).not.toContain(copy.chat.notChanged);
  });
});
