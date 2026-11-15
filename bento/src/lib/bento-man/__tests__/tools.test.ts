/** The tools without the model: what Bento Man's hands can do, and what
 *  they refuse to. Every scenario here is one the eval set also sends
 *  through the model; this is the half that must hold regardless. */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store.memory";
import { replanDay, runTool, TOOLS, type ToolContext } from "../tools";
import { ProposalSchema } from "../diff";
import { buildContext, coverageWords } from "../context";
import { SYSTEM_PROMPT, voiceLint } from "../prompt";
import { copy } from "@/copy";

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
    for (const claim of ["I have verified information for Kyoto, Osaka and Nara.", "There's no verified duration for it.", "Bento's verified data says two hours."]) {
      expect(voiceLint(claim).map((v) => v.rule), claim).toEqual(["claim"]);
    }
    for (const fine of ["That record is unverified, so I won't guess.", "Its hours aren't verified yet, so check before you go.", "Bento has it on file.", "I verify nothing myself; Bento's records are what I go by."]) {
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
    expect(diff.after.filter((i) => i.change === "kept").length).toBeGreaterThan(0);
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
    // Hashes taken on the code before Q12; the common case's tool result,
    // and so its cost and caching, must not move.
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    const store = routed();
    const ctx = ctxFor(store);
    const plan = (await runTool("plan_days", {}, ctx)).result;
    expect(plan).not.toMatch(/coverage/);
    expect(sha(plan)).toBe("168f6a052cb9854a70fba44a9324d1ac1d92df91db831bfeb486e4dec990df2f");
    await store.applyProposal(ctx.proposal!);
    const replan = (await runTool("replan_day", { date: "2026-11-23", ops: [{ op: "start_at", time: "10:00" }] }, ctxFor(store))).result;
    expect(sha(replan)).toBe("baed1cdc434cbc8ffd68bb42196a439ce016759a4f058f9b447d2e892c77447c");
  });

  it("the main-sights line passes the voice lint", () => {
    expect(voiceLint(copy.mainSightsDay)).toEqual([]);
  });

  it("replan_day names a place id it cannot find", async () => {
    const store = routed();
    const r = await runTool("replan_day", { date: "2026-11-23", ops: [{ op: "remove", place_id: "kyt-nope" }] }, ctxFor(store));
    expect(r.isError).toBe(true);
    expect(r.result).toMatch(/use get_place/);
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
