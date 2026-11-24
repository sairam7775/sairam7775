/** The tools without the model: what Bento Man's hands can do, and what
 *  they refuse to. Every scenario here is one the eval set also sends
 *  through the model; this is the half that must hold regardless. */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store.memory";
import { shiftDate } from "../store";
import { replanDay, runTool, TOOLS, type ToolContext } from "../tools";
import { ProposalSchema } from "../diff";
import { buildContext, coverageWords } from "../context";
import { SYSTEM_PROMPT, voiceLint } from "../prompt";
import { clean, cleanToolResult } from "../guard";
import { placeSeeds } from "@/lib/places/seed";
import { seedToPlaceInput } from "@/lib/places/seed/to-input";
import { copy } from "@/copy";
import { cityTrainMinutes, MOVE_ALLOWANCE_MIN } from "@/lib/engine/travel-day";
import { DAY_BUDGET_MINUTES } from "@/lib/types";
import { SCENARIOS } from "../evals/scenarios";

const owner = { pace: "standard" as const, interestTags: ["shrines", "history", "nature"] as ("shrines" | "history" | "nature")[], energy: 0.25, crowdTolerance: 0.15, discovery: 0.5, excludes: ["beaches", "hiking"] };
const nov = { startDate: "2026-11-20", endDate: "2026-11-29" };

function ctxFor(store: MemoryStore): ToolContext {
  return { store, today: "2026-09-15", proposal: null };
}
const parse = (r: { result: string }) => JSON.parse(r.result);

describe("tool definitions", () => {
  it("are unique, documented and JSON-schema shaped", () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TOOLS) {
      expect(t.description?.length ?? 0).toBeGreaterThan(40);
      expect(t.input_schema.type).toBe("object");
    }
  });
  it("the prompt names every tool it tells the model to use", () => {
    for (const t of TOOLS) expect(SYSTEM_PROMPT).toContain(t.name);
  });
  it("the prompt itself passes the voice lint", () => {
    // The rules quote the banned phrases; the examples of the register must not use them.
    const examples = SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf("Examples of the register"));
    expect(examples.length).toBeGreaterThan(100);
    expect(voiceLint(examples)).toEqual([]);
  });
  it("the voice lint catches a claim that Bento's information is verified", () => {
    // Legal copy rule (bento/CLAUDE.md, "Legal pages"): never "verified" or
    // "checked" about Bento's information. Live replies said all three of these.
    for (const claim of [
      "I have verified information for Kyoto, Osaka and Nara.", "There's no verified duration for it.", "Bento's verified data says two hours.",
      "I have verified the opening hours.", "That time is verified in my records.", "Kyoto has 41 verified places.",
      // Subject first (Codex review).
      "Our hours are verified.", "Bento's information is verified.", "My places are all independently verified.", "The data here has been verified.",
    ]) {
      expect(voiceLint(claim).map((v) => v.rule), claim).toEqual(["claim"]);
    }
    for (const fine of [
      "That record is unverified, so I won't guess.", "Its hours aren't verified yet, so check before you go.", "Bento has it on file.", "I verify nothing myself; Bento's records are what I go by.",
      // "Verified" about something other than Bento's information.
      "Your identity may need to be verified at the hotel.",
      "Those hours are not independently verified, so check before you go.",
      "Have your passport ready; it is verified at check-in.",
      "Once the ryokan has verified your booking, they email a confirmation.",
      "Your JR Pass exchange order is verified at the ticket office before they print the pass.",
    ]) {
      expect(voiceLint(fine), fine).toEqual([]);
    }
  });
  it("the prompt gives him nothing about verification to repeat", () => {
    const sayable = [...SYSTEM_PROMPT.matchAll(/"([^"]+)"/g)].map((m) => m[1]).join("\n") + SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf("Examples of the register"));
    expect(sayable).not.toMatch(/verified/i);
    expect(SYSTEM_PROMPT).not.toMatch(/a human has verified|data is verified/);
  });
  it("the prompt names the filler the voice lint fails most", () => {
    // Live: "I am happy to help with that" failed voiceLint in 4 of 7 attack-roleplay runs.
    expect(SYSTEM_PROMPT).toContain('No "Great choice", "Absolutely", "Perfect", "Happy to help" or any enthusiasm used as filler.');
    expect(voiceLint("I am happy to help with that.").map((v) => v.rule)).toContain("phrase");
  });
  it("the prompt keeps every place in Japan in scope and looks it up (variant W4)", () => {
    // Live, 14 Nov: with a Kansai route he declined Tokyo Skytree without a
    // lookup. W4 (132 ablation runs, 15 Nov) brought the lookup back; the
    // round-3 "call get_place first" sentence caused two regressions and is gone.
    expect(SYSTEM_PROMPT).toMatch(/whether or not it is on the route/);
    expect(SYSTEM_PROMPT).toMatch(/off the route is never a reason to decline/);
    expect(SYSTEM_PROMPT).toContain("A named place anywhere in Japan is a Japan question, looked up like any other.");
    expect(SYSTEM_PROMPT).toContain("then the traveller's question or request in a traveller_message block. Answer it with your tools exactly as you would any question about Japan.");
    expect(SYSTEM_PROMPT).toContain("\"I don't know Takayama well enough yet to plan days there.\" That line is about planning days in a city; a question about one of its places is still a question to look up.");
    expect(SYSTEM_PROMPT).toMatch(/never a reason to skip a tool/);
    expect(SYSTEM_PROMPT).not.toMatch(/names a place, call get_place first/);
    expect(SYSTEM_PROMPT).toContain("- Facts. Use get_place before describing a place and route_between before describing a journey.");
  });
  it("the prompt keeps customs rules to the official source and models no decline line (variant X3)", () => {
    // Measured on 49dde40 (gemini-3.1-flash-lite): customs allowance stated
    // from memory 0 of 6 with X3, 5 of 6 before; the code-decline example
    // line is gone with it.
    expect(SYSTEM_PROMPT).toContain("Customs, medicine-import and visa rules are not yours to state, even roughly:");
    expect(SYSTEM_PROMPT).not.toContain("Help people stay inside the rules on customs, medicines and visas");
    expect(SYSTEM_PROMPT).not.toMatch(/isn't in my box/);
  });
  it("the voice lint catches Bento's internal words for coverage", () => {
    expect(voiceLint("Takayama is at stub tier.").map((v) => v.rule)).toEqual(["jargon"]);
    expect(voiceLint("Himeji has the main sights only. A deep breath, then the outline of the castle.")).toEqual([]);
  });
  it("the trip state and tool results hand the model the traveller's words, not tier names", async () => {
    const store = new MemoryStore({ trip: nov, prefs: owner, cities: [{ cityId: "takayama", nights: 9 }] });
    const state = buildContext(await store.state(), await store.cities(), "2026-09-15");
    expect(state).toMatch(/Takayama \(takayama\) · 9 nights · not covered yet/);
    expect(state).toMatch(/Himeji \(himeji, main sights only, \d+ verified places\)/);
    const assessed = (await runTool("assess_route", { cities: [{ city_id: "kyoto-city", nights: 5 }, { city_id: "takayama", nights: 4 }] }, ctxFor(store))).result;
    const suggested = (await runTool("suggest_route", {}, ctxFor(store))).result;
    const place = (await runTool("get_place", { query: "Kiyomizu" }, ctxFor(store))).result;
    expect(JSON.parse(place).matches[0]).toMatchObject({ city_coverage: "well covered" });
    for (const text of [state, assessed, suggested, place]) expect(text).not.toMatch(/\b(tiers?|stub|outline|deep)\b/i);
  });
});

describe("set_preferences / set_trip_dates", () => {
  it("merges answers and marks onboarding done", async () => {
    const store = new MemoryStore();
    const ctx = ctxFor(store);
    expect((await store.state()).prefs.set).toBe(false);
    const r = await runTool("set_preferences", { pace: "relaxed", interest_tags: ["food"], excludes: ["hiking"] }, ctx);
    expect(parse(r).preferences).toMatchObject({ pace: "relaxed", interestTags: ["food"], excludes: ["hiking"], set: true });
    await runTool("set_preferences", { crowd_tolerance: 0.1 }, ctx);
    expect((await store.state()).prefs).toMatchObject({ pace: "relaxed", crowdTolerance: 0.1 });
  });
  it("rejects an unknown interest tag and a backwards date range", async () => {
    const ctx = ctxFor(new MemoryStore());
    expect((await runTool("set_preferences", { interest_tags: ["skiing"] }, ctx)).isError).toBe(true);
    expect((await runTool("set_trip_dates", { start_date: "2026-11-29", end_date: "2026-11-20" }, ctx)).isError).toBe(true);
    const ok = await runTool("set_trip_dates", { start_date: "2026-11-20", end_date: "2026-11-29" }, ctx);
    expect(parse(ok).nights).toBe(9);
  });
});

describe("routes", () => {
  it("assess_route refuses five cities in nine nights with the arithmetic", async () => {
    const ctx = ctxFor(new MemoryStore({ trip: nov, prefs: owner }));
    const r = parse(await runTool("assess_route", { cities: [
      { city_id: "osaka-city", nights: 2 }, { city_id: "kyoto-city", nights: 2 }, { city_id: "nara-city", nights: 2 }, { city_id: "himeji", nights: 1 }, { city_id: "hiroshima-city", nights: 2 },
    ] }, ctx));
    expect(r.verdict).toBe("overpacked");
    expect(r.arithmetic).toMatch(/4 city changes/);
    expect(r.cities.map((c: { coverage: string }) => c.coverage)).toEqual(["well covered", "well covered", "well covered", "main sights only", "well covered"]);
  });
  it("assess_route names an unknown city id", async () => {
    const r = await runTool("assess_route", { cities: [{ city_id: "kyoto", nights: 3 }] }, ctxFor(new MemoryStore()));
    expect(r.isError).toBe(true);
    expect(r.result).toMatch(/unknown city id/);
  });
  it("propose_route produces a dated proposal and nothing is applied", async () => {
    const store = new MemoryStore({ trip: nov, prefs: owner });
    const ctx = ctxFor(store);
    const r = parse(await runTool("propose_route", { cities: [
      { city_id: "osaka-city", nights: 2, reason: "Airport and food." }, { city_id: "kyoto-city", nights: 5, reason: "The point of the trip." }, { city_id: "hiroshima-city", nights: 2, reason: "Peace Park and Miyajima." },
    ] }, ctx));
    expect(r.proposed).toBe(true);
    expect(ctx.proposal?.route?.after.map((c) => c.arriveDate)).toEqual(["2026-11-20", "2026-11-22", "2026-11-27"]);
    expect(ProposalSchema.safeParse(ctx.proposal).success).toBe(true);
    expect((await store.state()).cities).toEqual([]);
    await store.applyProposal(ctx.proposal!);
    expect((await store.state()).cities.map((c) => c.name)).toEqual(["Osaka", "Kyoto", "Hiroshima"]);
  });
  it("suggest_route reads the nights from the trip and assesses itself", async () => {
    const r = parse(await runTool("suggest_route", {}, ctxFor(new MemoryStore({ trip: nov, prefs: owner }))));
    expect(r.cities.reduce((t: number, c: { nights: number }) => t + c.nights, 0)).toBe(9);
    expect(r.assessment.verdict).not.toBe("overpacked");
  });

  const fiveCities = [
    { city_id: "osaka-city", nights: 2, reason: "r" }, { city_id: "kyoto-city", nights: 2, reason: "r" }, { city_id: "nara-city", nights: 2, reason: "r" }, { city_id: "himeji", nights: 1, reason: "r" }, { city_id: "hiroshima-city", nights: 2, reason: "r" },
  ];
  it("propose_route refuses an overpacked route the traveller hasn't insisted on", async () => {
    const ctx = ctxFor(new MemoryStore({ trip: nov, prefs: owner }));
    const r = await runTool("propose_route", { cities: fiveCities }, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toMatch(/overpacked \(.*4 city changes/);
    expect(ctx.proposal).toBeNull();
  });
  it("propose_route won't take 'they insist' in the same reply as its refusal", async () => {
    const ctx = ctxFor(new MemoryStore({ trip: nov, prefs: owner }));
    await runTool("propose_route", { cities: fiveCities }, ctx);
    expect((await runTool("propose_route", { cities: fiveCities, traveller_insists: true }, ctx)).isError).toBe(true);
    expect(ctx.proposal).toBeNull();
  });
  it("propose_route proposes an overpacked route the traveller insisted on, marked overpacked", async () => {
    const ctx = ctxFor(new MemoryStore({ trip: nov, prefs: owner }));
    // The turn they insist, the model assesses again first; that must not block it.
    await runTool("assess_route", { cities: fiveCities.map(({ city_id, nights }) => ({ city_id, nights })) }, ctx);
    const r = parse(await runTool("propose_route", { cities: fiveCities, traveller_insists: true }, ctx));
    expect(r.proposed).toBe(true);
    expect(ctx.proposal?.route?.verdict).toBe("overpacked");
    expect(ProposalSchema.safeParse(ctx.proposal).success).toBe(true);
  });
});

describe("suggest_route and the ready-made trips", () => {
  // The memory store plans the Kansai–Sanyo corridor and lists Tokyo,
  // Kamakura and Yokohama as not planned (or not at all), like live before
  // the owner promotes them.
  const days5 = { startDate: "2026-11-20", endDate: "2026-11-24" };
  const week = { startDate: "2026-11-20", endDate: "2026-11-26" };
  const sha = (s: string) => createHash("sha256").update(s).digest("hex");
  const suggest = async (store: MemoryStore, input: object = {}) => {
    const r = await runTool("suggest_route", input, ctxFor(store));
    expect(r.isError).toBeFalsy();
    return r.result;
  };

  it("offers the ready-made trip for the trip's length, in the picker's words", async () => {
    const text = await suggest(new MemoryStore({ trip: days5, prefs: owner }));
    const r = JSON.parse(text);
    const words = copy.readyMade.trips["osaka-kyoto-nara-5"];
    expect(r.ready_made).toHaveLength(1);
    expect(r.cities).toBeUndefined();
    expect(r.ready_made[0]).toMatchObject({
      id: "osaka-kyoto-nara-5",
      title: words.title,
      summary: words.summary,
      days: 5,
      nights: 4,
      cities: [
        { city_id: "osaka-city", name: "Osaka", nights: 2, reason: words.reasons["osaka-city"], coverage: "well covered" },
        { city_id: "kyoto-city", name: "Kyoto", nights: 2, reason: words.reasons["kyoto-city"], coverage: "well covered" },
        { city_id: "nara-city", name: "Nara", nights: 0, reason: words.reasons["nara-city"], coverage: "well covered" },
      ],
      day_trips: [{ day: 4, city: "Nara" }],
    });
    expect(r.ready_made[0].must_see).toEqual([
      { day: 1, city: "Osaka", places: ["Dotonbori"] },
      { day: 2, city: "Osaka", places: ["Osaka Castle"] },
      { day: 3, city: "Kyoto", places: ["Kiyomizu-dera", "Gion — Hanamikoji"] },
      { day: 4, city: "Nara", places: ["Todai-ji", "Kasuga Taisha"] },
      { day: 5, city: "Kyoto", places: ["Arashiyama Bamboo Grove"] },
    ]);
    expect(r.ready_made[0].assessment.verdict).not.toBe("overpacked");
    expect(r.ready_made[0].assessment.nights_mismatch).toBeNull();
    // Where to start it: the planner's tab, as a fact, not a link to invent.
    expect(r).toMatchObject({
      nights_asked: 4,
      exact: true,
      same_as: "the trips on the Ready-made trips tab of the Plan a Japan trip page",
      start_on: "/trips/plan?tab=ready-made",
    });
    expect(r.times).toMatch(/set by the planner when the trip starts/);
    expect(r.length_note).toBeUndefined();
  });

  it("reads as data, not as instructions to the model", async () => {
    for (const input of [{}, { nights: 7 }]) {
      const r = JSON.parse(await suggest(new MemoryStore({ trip: input.nights ? undefined : days5, prefs: owner }), input));
      const words = JSON.stringify({ ...r, ready_made: undefined });
      expect(words, words).not.toMatch(/(say|says|name|describe|tell|call|mention|repeat|use)/i);
      expect(words).not.toMatch(/propose_route/);
    }
  });

  it("states no clock time and no internal coverage word, and passes clean() unchanged", async () => {
    for (const trip of [days5, week]) {
      const text = await suggest(new MemoryStore({ trip, prefs: owner }));
      expect(text).not.toMatch(/\b\d{1,2}:\d{2}\b/);
      expect(text).not.toMatch(/\b(tiers?|stub|outline|deep)\b/i);
      expect(clean(text)).toBe(text);
      expect(cleanToolResult(text)).toBe(text);
    }
  });

  it("offers only the week whose cities are all planned in this store", async () => {
    const r = JSON.parse(await suggest(new MemoryStore({ trip: week, prefs: owner })));
    // classic-7 goes through Tokyo, which this store doesn't plan.
    expect(r.ready_made.map((t: { id: string }) => t.id)).toEqual(["kansai-hiroshima-7"]);
    expect(r.ready_made[0].day_trips).toEqual([{ day: 3, city: "Himeji" }, { day: 6, city: "Nara" }]);
    // Tokyo planned but none of its places on hand (this store holds the
    // corridor's places only): classic-7 still isn't offered.
    const tokyo = await suggest(new MemoryStore({ trip: week, prefs: owner, tiers: { "tokyo-city": "outline" } }));
    expect(JSON.parse(tokyo).ready_made.map((t: { id: string }) => t.id)).toEqual(["kansai-hiroshima-7"]);
    class WithTokyo extends MemoryStore {
      async places(cityId: string) {
        if (cityId !== "tokyo-city") return super.places(cityId);
        return placeSeeds.flatMap((s) => s.places).filter((p) => p.city === cityId).map((p) => seedToPlaceInput(p, { tier: "outline", status: "verified" }));
      }
    }
    const both = JSON.parse(await suggest(new WithTokyo({ trip: week, prefs: owner, tiers: { "tokyo-city": "outline" } })));
    expect(both.ready_made.map((t: { id: string }) => t.id)).toEqual(["classic-7", "kansai-hiroshima-7"]);
    expect(both.ready_made[0].title).toBe(copy.readyMade.trips["classic-7"].title);
  });

  it("never offers a trip through a city that isn't planned: the corridor table instead", async () => {
    const r = JSON.parse(await suggest(new MemoryStore({ trip: week, prefs: owner, tiers: { himeji: "stub" } })));
    expect(r.ready_made).toBeUndefined();
    expect(r.cities.reduce((t: number, c: { nights: number }) => t + c.nights, 0)).toBe(6);
  });

  it("never offers a trip whose must-see place the store can't show", async () => {
    class NoKasuga extends MemoryStore {
      async places(cityId: string) {
        return (await super.places(cityId)).filter((p) => p.id !== "nra-kasuga-taisha");
      }
    }
    const r = JSON.parse(await suggest(new NoKasuga({ trip: days5, prefs: owner })));
    expect(r.ready_made).toBeUndefined();
    expect(r.cities).toBeDefined();
  });

  it("with the trip's own dates, never offers a trip whose must-see would be closed on its day", async () => {
    // Osaka Castle closes 28 Dec – 1 Jan; the five days put it on day 2.
    for (const startDate of ["2026-12-27", "2026-12-30", "2026-12-31"]) {
      const r = JSON.parse(await suggest(new MemoryStore({ trip: { startDate, endDate: shiftDate(startDate, 4) }, prefs: owner })));
      expect(r.ready_made, startDate).toBeUndefined();
      expect(r.cities, startDate).toBeDefined();
    }
    for (const startDate of ["2026-12-26", "2027-01-01"]) {
      const r = JSON.parse(await suggest(new MemoryStore({ trip: { startDate, endDate: shiftDate(startDate, 4) }, prefs: owner })));
      expect(r.ready_made.map((t: { id: string }) => t.id), startDate).toEqual(["osaka-kyoto-nara-5"]);
    }
    // No dates: nothing to check against, so it is offered as before.
    const undated = JSON.parse(await suggest(new MemoryStore({ prefs: owner }), { nights: 4 }));
    expect(undated.ready_made.map((t: { id: string }) => t.id)).toEqual(["osaka-kyoto-nara-5"]);
  });

  it("takes nights given as a trip of one more day, or of as many days when none is that long", async () => {
    const asked = JSON.parse(await suggest(new MemoryStore({ prefs: owner }), { nights: 6 }));
    expect(asked.ready_made.map((t: { id: string }) => t.id)).toEqual(["kansai-hiroshima-7"]);
    expect(asked).toMatchObject({ nights_asked: 6, exact: true });
    expect(asked.length_note).toBeUndefined();
    // "A week" passed as seven nights: no 8-day trip, so the 7-day one,
    // said to be a night shorter.
    const seven = JSON.parse(await suggest(new MemoryStore({ prefs: owner }), { nights: 7 }));
    expect(seven.ready_made.map((t: { id: string }) => t.id)).toEqual(["kansai-hiroshima-7"]);
    expect(seven).toMatchObject({ nights_asked: 7, exact: false, length_note: "6 nights, one fewer than the 7 nights asked for" });
    // Singular: one night asked, the 1-day trips (no night) offered.
    const one = JSON.parse(await suggest(new MemoryStore({ prefs: owner, tiers: { "kyoto-city": "stub", "osaka-city": "stub" } }), { nights: 1 }));
    expect(one.length_note).toBe("0 nights, one fewer than the 1 night asked for");
  });

  it("with the trip's own dates, offers exact lengths only, so propose_route takes what is offered", async () => {
    // Seven nights (8 days) and three nights (4 days): no trip that long.
    // The 7-day and 3-day trips a night short would be refused by
    // propose_route, so the corridor table answers instead.
    for (const endDate of ["2026-11-27", "2026-11-23"]) {
      const r = JSON.parse(await suggest(new MemoryStore({ trip: { startDate: "2026-11-20", endDate }, prefs: owner })));
      expect(r.ready_made, endDate).toBeUndefined();
      expect(r.cities).toBeDefined();
    }
    // Nights passed for a trip that has dates: still no shorter trip.
    const passed = JSON.parse(await suggest(new MemoryStore({ trip: { startDate: "2026-11-20", endDate: "2026-11-27" }, prefs: owner }), { nights: 7 }));
    expect(passed.ready_made).toBeUndefined();
    // Every trip offered for the trip's own dates is one propose_route takes.
    const tiers = { "tokyo-city": "outline" as const, kamakura: "outline" as const, yokohama: "outline" as const };
    class AllPlaces extends MemoryStore {
      async places(cityId: string) {
        if (!(cityId in tiers)) return super.places(cityId);
        return placeSeeds.flatMap((s) => s.places).filter((p) => p.city === cityId).map((p) => seedToPlaceInput(p, { tier: "outline", status: "verified" }));
      }
    }
    let offered = 0;
    for (let nights = 1; nights <= 13; nights++) {
      const endDate = shiftDate("2026-11-20", nights);
      const r = JSON.parse(await suggest(new AllPlaces({ trip: { startDate: "2026-11-20", endDate }, prefs: owner, tiers })));
      for (const t of r.ready_made ?? []) {
        offered++;
        const ctx = ctxFor(new AllPlaces({ trip: { startDate: "2026-11-20", endDate }, prefs: owner, tiers }));
        const p = await runTool("propose_route", { cities: t.cities.map((c: { city_id: string; nights: number; reason: string }) => ({ city_id: c.city_id, nights: c.nights, reason: c.reason })) }, ctx);
        expect(p.isError, `${t.id}: ${p.result}`).toBeFalsy();
      }
    }
    expect(offered).toBeGreaterThan(5);
  });

  it("gives the route-suggest-kansai-5 eval scenario the ready-made trip, unchanged by the closure check", async () => {
    // 20–24 Nov puts no must-see on a closed day, so the dated check must
    // leave the result exactly as for the same five days without dates.
    const s = SCENARIOS.find((x) => x.id === "route-suggest-kansai-5")!;
    const dated = await suggest(new MemoryStore(s.setup));
    expect(JSON.parse(dated).ready_made.map((t: { id: string }) => t.id)).toEqual(["osaka-kyoto-nara-5"]);
    expect(await suggest(new MemoryStore(s.setup), { nights: 4 })).toBe(dated);
    expect(await suggest(new MemoryStore({ ...s.setup, trip: undefined }), { nights: 4 })).toBe(dated);
  });

  it("leaves the corridor table's result byte for byte as it was when nothing matches", async () => {
    // Taken on main (c0e5614) before ready-made trips reached this tool.
    // Nine nights: the 10-day trip goes through Tokyo; eight: no 9- or 8-day
    // trip; thirteen: the 14-day trip goes through Kamakura and Yokohama.
    // Refreshed when Osaka's hub became Osaka Station: only the Osaka →
    // Kyoto leg (Special Rapid, 29 min, ¥580, not the 13-minute Nozomi from
    // Shin-Osaka) and the train hours in the arithmetic (3h 09m → 3h 25m)
    // changed; with the old hub put back, all three hash to the previous values.
    // Refreshed again (23 Nov 2026) for the through Shinkansen from Kyoto to
    // Himeji: only the Kyoto → Himeji leg (one Hikari, 50 min, ¥4,740, not
    // the Nozomi to Shin-Osaka and a change, 48 min, ¥4,730) and the train
    // hours in the arithmetic (3h 25m → 3h 27m) changed.
    const store = () => new MemoryStore({ trip: nov, prefs: owner });
    expect(sha(await suggest(store()))).toBe("85ff27806882b6f1111757143575c113dfaa8ddf3bec1a3a6c5e74810d1b8f47");
    expect(sha(await suggest(store(), { nights: 8 }))).toBe("6a6da3338d3224d8aa65229f30a05b3c7c1f62a8676660e4008cb164e878b90a");
    expect(sha(await suggest(store(), { nights: 13 }))).toBe("a9cc40d84fe1ca5ff2ae6d91ccbe7ed56766ef1bc5a7c43917b7d554ff02007f");
  });
});

describe("days", () => {
  const routed = () => new MemoryStore({ trip: nov, prefs: owner, cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }] });

  it("plan_days plans every empty day of the route, in order, without reusing a place", async () => {
    const ctx = ctxFor(routed());
    const r = parse(await runTool("plan_days", {}, ctx));
    expect(r.days.map((d: { date: string }) => d.date)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"]);
    expect(r.days[0].city_id).toBe("osaka-city");
    expect(r.days[2].city_id).toBe("kyoto-city");
    const ids = ctx.proposal!.days.flatMap((d) => d.after.map((i) => i.placeId));
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of ctx.proposal!.days) expect(d.after.every((i) => i.change === "added")).toBe(true);
  });

  it("plan_days starts each travel day after the move, and every other day as usual", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    await runTool("plan_days", {}, ctx);
    const graph = await store.graph();
    const train = cityTrainMinutes(graph);
    // Osaka → Kyoto on the 22nd, Kyoto → Hiroshima on the 27th.
    const moves = new Map([
      ["2026-11-22", MOVE_ALLOWANCE_MIN + train("osaka-city", "kyoto-city")!],
      ["2026-11-27", MOVE_ALLOWANCE_MIN + train("kyoto-city", "hiroshima-city")!],
    ]);
    for (const d of ctx.proposal!.days) {
      const move = moves.get(d.date) ?? 0;
      expect(d.budgetMin, d.date).toBe(DAY_BUDGET_MINUTES.standard - move);
      // The owner rises early: 07:00.
      if (move) expect(d.after[0].startMin, d.date).toBeGreaterThanOrEqual(7 * 60 + move);
    }
    // A day trip on a stay's own days is not a move.
    const trip = ctxFor(routed());
    await runTool("plan_days", { dates: [{ date: "2026-11-24", city_id: "nara-city" }] }, trip);
    expect(trip.proposal!.days[0].budgetMin).toBe(DAY_BUDGET_MINUTES.standard);
  });

  it("replan_day keeps a travel day's move: the same start and the same shorter day", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    await runTool("plan_days", {}, ctx);
    await store.applyProposal(ctx.proposal!);
    const move = MOVE_ALLOWANCE_MIN + cityTrainMinutes(await store.graph())("osaka-city", "kyoto-city")!;
    const planned = ctx.proposal!.days.find((d) => d.date === "2026-11-22")!;
    const again = await replanDay(store, "2026-11-22", []);
    if (!("diff" in again)) throw new Error(again.error);
    expect(again.diff.budgetMin).toBe(DAY_BUDGET_MINUTES.standard - move);
    expect(again.diff.after[0].startMin).toBe(planned.after[0].startMin);
    expect(again.diff.activeMin).toBeLessThanOrEqual(again.diff.budgetMin);
    // A start the traveller names is a clock time; the move still comes out of the day.
    const ten = await replanDay(store, "2026-11-22", [{ op: "start_at", time: "10:00" }]);
    if (!("diff" in ten)) throw new Error(ten.error);
    expect(ten.diff.budgetMin).toBe(DAY_BUDGET_MINUTES.standard - move);
    expect(ten.diff.after[0].startMin).toBeGreaterThanOrEqual(10 * 60);
    expect(ten.diff.after[0].startMin).toBeLessThan(10 * 60 + move);
    // Any other day keeps the whole day.
    const other = await replanDay(store, "2026-11-23", []);
    if (!("diff" in other)) throw new Error(other.error);
    expect(other.diff.budgetMin).toBe(DAY_BUDGET_MINUTES.standard);
  });

  it("replan_day moves a travel day saved before the move was allowed for to after it", async () => {
    // Saved under the old rule: the first stop at 07:00 on the day the
    // traveller arrives from Osaka.
    const store = new MemoryStore({
      trip: nov, prefs: owner,
      cities: [{ cityId: "osaka-city", nights: 2 }, { cityId: "kyoto-city", nights: 5 }, { cityId: "hiroshima-city", nights: 2 }],
      days: [{ date: "2026-11-22", cityId: "kyoto-city", items: [
        { placeId: "kyt-kiyomizu", name: "Kiyomizu-dera", sortOrder: 0, startMin: 7 * 60, durationMin: 90, locked: false, reason: null, reasonTerms: [], arriveMode: null, arriveMinutes: null, arriveDetail: null },
      ] }],
    });
    const move = MOVE_ALLOWANCE_MIN + cityTrainMinutes(await store.graph())("osaka-city", "kyoto-city")!;
    const r = await replanDay(store, "2026-11-22", []);
    if (!("diff" in r)) throw new Error(r.error);
    expect(r.diff.after[0].startMin).toBeGreaterThanOrEqual(7 * 60 + move);
    expect(r.diff.budgetMin).toBe(DAY_BUDGET_MINUTES.standard - move);
  });

  it("plan_days moves a day trip on an arrival date: from the last stay to the day trip", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    await runTool("plan_days", { dates: [{ date: "2026-11-22", city_id: "nara-city" }] }, ctx);
    const move = MOVE_ALLOWANCE_MIN + cityTrainMinutes(await store.graph())("osaka-city", "nara-city")!;
    expect(ctx.proposal!.days[0].budgetMin).toBe(DAY_BUDGET_MINUTES.standard - move);
  });

  it("plan_days keeps Fushimi Inari and Arashiyama on different days and honours 'no hiking'", async () => {
    const ctx = ctxFor(routed());
    await runTool("plan_days", {}, ctx);
    const byDay = ctx.proposal!.days.map((d) => new Set(d.after.map((i) => i.placeId)));
    expect(byDay.some((s) => s.has("kyt-fushimi-inari") && s.has("kyt-arashiyama-bamboo"))).toBe(false);
    const all = ctx.proposal!.days.flatMap((d) => d.after.map((i) => i.placeId));
    expect(all).not.toContain("kyt-kurama-kibune");
    expect(all).not.toContain("nra-kasugayama-forest");
  });

  it("plan_days can plan a Nara day trip inside the Kyoto block", async () => {
    const ctx = ctxFor(routed());
    const r = parse(await runTool("plan_days", { dates: [{ date: "2026-11-24", city_id: "nara-city" }] }, ctx));
    expect(r.days).toHaveLength(1);
    expect(r.days[0].city_id).toBe("nara-city");
    expect(ctx.proposal!.days[0].after.some((i) => i.placeId === "nra-todaiji")).toBe(true);
  });

  it("plan_days refuses a stub city plainly", async () => {
    const ctx = ctxFor(new MemoryStore({ trip: nov, prefs: owner, cities: [{ cityId: "takayama", nights: 9 }] }));
    const r = await runTool("plan_days", {}, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toContain(copy.plan.route.notCovered("Takayama"));
    expect(ctx.proposal).toBeNull();
  });

  it("replan_day removes a place, pins another at a time, and flags the changes", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    await runTool("plan_days", {}, ctx);
    await store.applyProposal(ctx.proposal!);
    const day = (await store.state()).days.find((d) => d.cityId === "kyoto-city")!;
    const victim = day.items[0].placeId;
    const ctx2 = ctxFor(store);
    const r = parse(await runTool("replan_day", { date: day.date, ops: [{ op: "remove", place_id: victim }, { op: "pin", place_id: "kyt-sanjusangendo", time: "10:00" }] }, ctx2));
    const diff = ctx2.proposal!.days[0];
    expect(r.day.date).toBe(day.date);
    expect(diff.after.map((i) => i.placeId)).not.toContain(victim);
    expect(diff.removed.map((x) => x.placeId)).toContain(victim);
    const pinned = diff.after.find((i) => i.placeId === "kyt-sanjusangendo")!;
    expect(pinned.locked).toBe(true);
    expect(pinned.startMin).toBe(600);
    // The day's other stops stay, in an order round the 10:00 pin (so "moved"
    // counts as staying: the pin can reorder every one of them).
    const stayed = diff.after.filter((i) => i.placeId !== "kyt-sanjusangendo" && day.items.some((d) => d.placeId === i.placeId));
    expect(stayed.length).toBeGreaterThan(0);
    for (const i of stayed) expect(["kept", "moved"]).toContain(i.change);
  });

  it("replan_day keeps a category out for the day", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    await runTool("plan_days", {}, ctx);
    await store.applyProposal(ctx.proposal!);
    const day = (await store.state()).days.find((d) => d.cityId === "kyoto-city")!;
    const ctx2 = ctxFor(store);
    await runTool("replan_day", { date: day.date, ops: [{ op: "avoid_category", category: "temple" }] }, ctx2);
    const cats = await store.places("kyoto-city");
    const byId = new Map(cats.map((p) => [p.id, p.category]));
    expect(ctx2.proposal!.days[0].after.every((i) => byId.get(i.placeId) !== "temple")).toBe(true);
  });

  it("replan_day keeps an accepted later start through unrelated changes", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    await runTool("plan_days", {}, ctx);
    await store.applyProposal(ctx.proposal!);
    const date = (await store.state()).days.find((d) => d.cityId === "kyoto-city")!.date;

    const late = ctxFor(store);
    await runTool("replan_day", { date, ops: [{ op: "start_at", time: "10:00" }] }, late);
    await store.applyProposal(late.proposal!);
    const day = (await store.state()).days.find((d) => d.date === date)!;
    expect(day.items[0].startMin).toBe(600);

    const victim = day.items[day.items.length - 1].placeId;
    for (const ops of [[{ op: "remove", place_id: victim }], [{ op: "avoid_category", category: "temple" }]]) {
      const c = ctxFor(store);
      await runTool("replan_day", { date, ops }, c);
      const first = c.proposal!.days[0].after[0];
      expect(first.startMin, JSON.stringify(ops)).toBe(600);
    }

    const earlier = ctxFor(store);
    await runTool("replan_day", { date, ops: [{ op: "start_at", time: "08:30" }] }, earlier);
    expect(earlier.proposal!.days[0].after[0].startMin).toBe(510);
  });

  // Q12: a city Bento knows by its main sights still gets a day plan, and
  // the result says so in the page's words, never the internal ones.
  const MAIN_SIGHTS = coverageWords("outline");

  it("plan_days plans a day in a main-sights city and says what it is", async () => {
    const ctx = ctxFor(routed());
    const raw = (await runTool("plan_days", { dates: [{ date: "2026-11-28", city_id: "miyajima" }] }, ctx)).result;
    const r = JSON.parse(raw);
    expect(r.days).toHaveLength(1);
    expect(r.days[0].stops.length).toBeGreaterThan(0);
    expect(ctx.proposal!.days[0].cityId).toBe("miyajima");
    expect(r.days[0].coverage).toBe(MAIN_SIGHTS);
    expect(r.days[0].coverage_note).toContain(copy.mainSightsDay);
    expect(r.days[0].coverage_note).toMatch(/complete/);
    // What he is told to say must pass the lint his reply is held to (claim rule included).
    expect(voiceLint(r.days[0].coverage_note)).toEqual([]);
    expect(raw).not.toMatch(/\b(tiers?|stub|outline)\b/i);
  });

  it("replan_day keeps working on a main-sights day and says what it is", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    await runTool("plan_days", { dates: [{ date: "2026-11-28", city_id: "miyajima" }] }, ctx);
    await store.applyProposal(ctx.proposal!);
    const day = (await store.state()).days.find((d) => d.date === "2026-11-28")!;
    const ctx2 = ctxFor(store);
    const raw = (await runTool("replan_day", { date: day.date, ops: [{ op: "remove", place_id: day.items[0].placeId }] }, ctx2)).result;
    const r = JSON.parse(raw);
    expect(r.proposed).toBe(true);
    expect(r.day.coverage).toBe(MAIN_SIGHTS);
    expect(r.day.coverage_note).toContain(copy.mainSightsDay);
    expect(raw).not.toMatch(/\b(tiers?|stub|outline)\b/i);
    const direct = await replanDay(store, day.date, []);
    expect("diff" in direct && direct.diff.after.length).toBeGreaterThan(0);
  });

  it("leaves a well-covered city's plan_days and replan_day results byte for byte as they were", async () => {
    // Pins the common case's tool result, and so its cost and caching.
    // First taken on the code before Q12; refreshed when the Kyoto seed
    // gained the Arashiyama-area conflicts, which changed these plans, and
    // when "has no station" warnings stopped naming places a day doesn't
    // hold (same stops, fewer warnings), and when travel days started after
    // the move (the 22nd and 27th; the re-planned 23rd differs because the
    // days before it hold other places), and when the season reason became
    // "usually at its best around now" (same stops; with the old wording
    // put back, both results hash to the previous values), and when Osaka's
    // hub became Osaka Station (plan_days only: the 22nd's move is the
    // 29-minute Special Rapid, not the 13-minute Nozomi, so its times start
    // 16 minutes later with the same stops; the old hub gives the old hash),
    // and when days stopped going back and forth (stops walk straight
    // between neighbours, said as estimates, "Walk · about N min", never
    // to or from hikes or, in place of a train, steep places, and round a
    // castle's moat at 1.8; and move past pins, never past closing), so legs
    // are shorter and the days
    // hold other stops in other orders, and when evening-only places
    // (`eveningOnly`, 0033) stopped being planned by day and "unavoidable"
    // became true only when it is (plan_days only: Nagarekawa, "quiet until
    // eight", left the 29th's 12:31 and Mount Ogonzan's night view went in
    // at 17:30, with other stops round them; Fushimi Inari on the travel
    // day of the 22nd can still be reached after 17:30, so it says "busy at
    // this hour. It's quieter before 08:00 or after 17:30"; the re-planned
    // 23rd is byte for byte as before), and when days grew until their time
    // was spent instead of stopping at a count of stops per pace (more
    // stops, later ends; a stop fits its closing and opening times when it
    // is chosen; a long stay shares its city; a day that crosses town and
    // comes back loses the stop it came back for), and when growing kept
    // stops on the day's way, a chosen daytime stop ended by the day's end
    // and a re-plan shared the stay's unplanned days (stops nearer the day's way),
    // and when the read-through of 23 Nov 2026 (0035) gave Fudoin its station
    // (Hiroshima days now reach it by the Astram Line, other stops round it) and
    // a stop whose booking is recommended began to say "book about N days
    // ahead" (plan_days only),
    // and when a chosen stop more than 3.5 km off the line between its
    // neighbours was dropped and refilled (Fushimi Inari between Toji and
    // the Kamo river leaves that day).
    // Refresh only for a change that is meant to alter a well-covered plan.
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    const store = routed();
    const ctx = ctxFor(store);
    const plan = (await runTool("plan_days", {}, ctx)).result;
    expect(plan).not.toMatch(/coverage/);
    expect(sha(plan)).toBe("95041d5572785456109cfacf834f496d41fc9e37c9f7c5a8582271aa00caf2c7");
    await store.applyProposal(ctx.proposal!);
    const replan = (await runTool("replan_day", { date: "2026-11-23", ops: [{ op: "start_at", time: "10:00" }] }, ctxFor(store))).result;
    expect(sha(replan)).toBe("1c5c5dd1396e120e0f2fd6752d415a8bc76f9271ba211b6fd99be2168b858ba3");
  });

  it("the main-sights line passes the voice lint", () => {
    expect(voiceLint(copy.mainSightsDay)).toEqual([]);
  });

  it("replan_day names a place id it cannot find, and says nothing was proposed", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    const r = await runTool("replan_day", { date: "2026-11-23", ops: [{ op: "remove", place_id: "kyt-nope" }] }, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toBe("no place kyt-nope in Kyoto — use get_place to find the id. Nothing was proposed.");
    expect(ctx.proposal).toBeNull();
  });

  // Live (eval-outline-r1, 3 of 6 runs): "Make the 28th a day trip to
  // Miyajima" sent a Miyajima place to replan_day on a Hiroshima day, was told
  // only to use get_place, looped, and then said a proposal existed.
  const dayTripCall = `call plan_days with dates: [{"date":"2026-11-28","city_id":"miyajima"}].`;

  it("replan_day says a place from another city is there, and names the day-trip call", async () => {
    const ctx = ctxFor(routed());
    const r = await runTool("replan_day", { date: "2026-11-28", ops: [{ op: "add", place_id: "miy-itsukushima" }] }, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toBe(`miy-itsukushima is in Miyajima, not Hiroshima. Nothing was proposed. For a day trip there, ${dayTripCall}`);
    expect(ctx.proposal).toBeNull();
  });

  it("replan_day says a city id passed as a place is a city, and names the day-trip call", async () => {
    const ctx = ctxFor(routed());
    const r = await runTool("replan_day", { date: "2026-11-28", ops: [{ op: "pin", place_id: "miyajima" }] }, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toBe(`miyajima is a city, not a place in Hiroshima. Nothing was proposed. For a day trip there, ${dayTripCall}`);
    expect(ctx.proposal).toBeNull();
  });

  // Review F-04: a city given by its plain name, not its id.
  it("replan_day knows a city given by its name, and names the call with the city's id", async () => {
    const cases: [date: string, given: string, day: string, cityId: string][] = [
      ["2026-11-24", "nara", "Kyoto", "nara-city"],
      ["2026-11-28", "kyoto", "Hiroshima", "kyoto-city"],
      ["2026-11-24", "Hiroshima", "Kyoto", "hiroshima-city"],
      ["2026-11-24", "miyajima", "Kyoto", "miyajima"],
    ];
    for (const [date, given, day, cityId] of cases) {
      const ctx = ctxFor(routed());
      const r = await runTool("replan_day", { date, ops: [{ op: "pin", place_id: given }] }, ctx);
      expect(r.isError, given).toBe(true);
      expect(r.result, given).toBe(`${given} is a city, not a place in ${day}. Nothing was proposed. For a day trip there, call plan_days with dates: ${JSON.stringify([{ date, city_id: cityId }])}.`);
      const planned = await runTool("plan_days", { dates: [{ date, city_id: cityId }] }, ctx);
      expect(JSON.parse(planned.result).proposed, given).toBe(true);
    }
  });

  it("replan_day says Bento can't plan a day in a city it doesn't know, and names no call", async () => {
    const ctx = ctxFor(routed());
    const r = await runTool("replan_day", { date: "2026-11-24", ops: [{ op: "pin", place_id: "tokyo" }] }, ctx);
    expect(r.isError).toBe(true);
    expect(r.result).toBe(`tokyo is a city, not a place in Kyoto. Nothing was proposed. ${copy.plan.route.notCovered("Tokyo")}.`);
    expect(r.result).not.toMatch(/plan_days/);
  });

  it("the day-trip call the error names does plan the day trip", async () => {
    const ctx = ctxFor(routed());
    const r = parse(await runTool("plan_days", { dates: [{ date: "2026-11-28", city_id: "miyajima" }] }, ctx));
    expect(r.proposed).toBe(true);
    expect(ctx.proposal!.days[0].cityId).toBe("miyajima");
  });

  it("every other replan_day and plan_days error says nothing was proposed, without internal words", async () => {
    const NOTHING = "Nothing was proposed.";
    const cases: [string, unknown, () => MemoryStore][] = [
      ["replan_day", { date: "2026-11-23" }, routed],
      ["replan_day", { date: "2026-12-30", ops: [{ op: "start_at", time: "10:00" }] }, routed],
      ["replan_day", { date: "2026-11-23", ops: [{ op: "pin" }] }, routed],
      ["replan_day", { date: "2026-11-23", ops: [{ op: "avoid_category" }] }, routed],
      ["replan_day", { date: "2026-11-23", ops: [{ op: "start_at" }] }, routed],
      ["replan_day", { date: "2026-11-23", ops: [{ op: "start_at", time: "10:00" }] }, () => new MemoryStore({ trip: nov, prefs: owner, cities: [{ cityId: "takayama", nights: 9 }] })],
      ["plan_days", { dates: "soon" }, routed],
      ["plan_days", {}, () => new MemoryStore({ prefs: owner })],
      ["plan_days", { dates: [{ date: "2026-12-30" }] }, routed],
      ["plan_days", { dates: [{ date: "2026-11-23", city_id: "atlantis" }] }, routed],
      ["plan_days", {}, () => new MemoryStore({ trip: nov, prefs: owner })],
      ["plan_days", {}, () => new MemoryStore({ trip: nov, prefs: owner, cities: [{ cityId: "takayama", nights: 9 }] })],
    ];
    for (const [tool, input, store] of cases) {
      const ctx = ctxFor(store());
      const r = await runTool(tool, input, ctx);
      const label = `${tool} ${JSON.stringify(input)}: ${r.result}`;
      expect(r.isError, label).toBe(true);
      expect(r.result, label).toContain(NOTHING);
      expect(r.result.split(NOTHING)).toHaveLength(2);
      expect(r.result, label).not.toMatch(/\b(tiers?|stub|outline)\b/i);
      expect(ctx.proposal, label).toBeNull();
    }
  });

  it("plan_days with every day already planned says so and that nothing was proposed", async () => {
    const store = routed();
    const ctx = ctxFor(store);
    await runTool("plan_days", {}, ctx);
    await store.applyProposal(ctx.proposal!);
    const r = await runTool("plan_days", {}, ctxFor(store));
    expect(r.result).toBe("every day already has a plan — use replan_day with dates to change one. Nothing was proposed.");
  });
});

describe("facts", () => {
  it("get_place returns the verified judgement and nothing invented", async () => {
    const r = parse(await runTool("get_place", { query: "fushimi inari" }, ctxFor(new MemoryStore())));
    expect(r.matches[0]).toMatchObject({ id: "kyt-fushimi-inari", verified: true, cost: "free" });
    expect(r.matches[0]).not.toHaveProperty("cost_jpy");
    expect(r.matches[0].duration_min.typical).toBe(90);
    expect(r.matches[0].crowd_note).toMatch(/shuffling queue/);
  });

  it("get_place gives a price band and never promises seasonal hours", async () => {
    const r = parse(await runTool("get_place", { query: "ginkaku" }, ctxFor(new MemoryStore())));
    expect(r.matches[0]).toMatchObject({ id: "kyt-ginkakuji", cost: "¥500–1,500" });
    expect(r.matches[0].hours).toMatch(/^at least 09:00–16:50; hours change with the season/);
  });

  it("get_place states a closure that comes every year next to the hours, and only for places that have one", async () => {
    const castle = parse(await runTool("get_place", { query: "osk-osaka-castle" }, ctxFor(new MemoryStore())));
    expect(castle.matches[0]).toMatchObject({ id: "osk-osaka-castle", hours: "09:00–18:00", closed_every_year: "28 Dec – 1 Jan" });
    const inari = parse(await runTool("get_place", { query: "fushimi inari" }, ctxFor(new MemoryStore())));
    expect(inari.matches[0]).not.toHaveProperty("closed_every_year");
  });

  it("get_place says when nothing matches", async () => {
    const r = parse(await runTool("get_place", { query: "Skytree" }, ctxFor(new MemoryStore())));
    expect(r.matches).toEqual([]);
    expect(r.note).toMatch(/don't have it/);
  });
  const KINKAKU = "Built in 1397 as a retirement villa for the shogun Ashikaga Yoshimitsu, it became a Zen temple after his death. A monk burned it down in 1950; what stands now is the 1955 rebuild.";
  it("place_background retells a checked background and counts nothing", async () => {
    const store = new MemoryStore({ backgrounds: { "kyt-kinkakuji": { body: KINKAKU, sources: ["shokoku-ji.jp"] } } });
    const r = parse(await runTool("place_background", { query: "kyt-kinkakuji" }, ctxFor(store)));
    expect(r).toMatchObject({ id: "kyt-kinkakuji", name: "Kinkaku-ji", background: KINKAKU, sources: ["shokoku-ji.jp"], checked: true });
    expect(store.asks).toEqual([]);
  });
  it("place_background with none yet counts the ask and allows general background", async () => {
    const store = new MemoryStore();
    const r = parse(await runTool("place_background", { query: "Kiyomizu" }, ctxFor(store)));
    expect(r).toMatchObject({ id: "kyt-kiyomizu", background: null });
    expect(r.note).toMatch(/general background/);
    expect(r.note).toMatch(/nothing a traveller would act on/);
    expect(store.asks).toEqual(["kyt-kiyomizu"]);
  });
  it("place_background for an unknown place counts nothing", async () => {
    const store = new MemoryStore();
    const r = parse(await runTool("place_background", { query: "Skytree" }, ctxFor(store)));
    expect(r.matches).toEqual([]);
    expect(r.note).toMatch(/don't have it/);
    expect(store.asks).toEqual([]);
  });
  it("place_background asks which place when a name matches several, and counts nothing", async () => {
    const store = new MemoryStore();
    const r = parse(await runTool("place_background", { query: "castle" }, ctxFor(store)));
    expect(r.background).toBeUndefined();
    expect(r.matches.map((m: { id: string }) => m.id)).toEqual(expect.arrayContaining(["hmj-castle", "hir-castle"]));
    expect(r.note).toMatch(/several/);
    expect(store.asks).toEqual([]);
  });
  it("place_background takes the place whose name matches exactly", async () => {
    const store = new MemoryStore();
    const r = parse(await runTool("place_background", { query: "Todai-ji" }, ctxFor(store)));
    expect(r.id).toBe("nra-todaiji");
    expect(store.asks).toEqual(["nra-todaiji"]);
  });
  it("keeps the tool order stable, with place_background last", () => {
    expect(TOOLS.at(-1)?.name).toBe("place_background");
  });
  it("route_between describes a journey a traveller can follow, from places or stations", async () => {
    const r = parse(await runTool("route_between", { from: "kyoto", to: "kyt-fushimi-inari" }, ctxFor(new MemoryStore())));
    expect(r.summary).toMatch(/Kyoto → Inari/);
    expect(r.legs.join(" ")).toMatch(/Rapid does not stop at Inari/);
    const c = parse(await runTool("route_between", { from: "kyoto-city", to: "hiroshima-city" }, ctxFor(new MemoryStore())));
    expect(c.summary).toMatch(/Kyoto → Hiroshima/);
  });
});

describe("context", () => {
  it("shows what is unset so onboarding can start, and which cities are known", async () => {
    const store = new MemoryStore();
    const text = buildContext(await store.state(), await store.cities(), "2026-09-15");
    expect(text).toMatch(/preferences: not set yet/);
    expect(text).toMatch(/route: none yet/);
    expect(text).toMatch(/Kyoto \(kyoto-city, well covered, 41 verified places\)/);
    expect(text).not.toMatch(/Takayama \(/);
  });
});
