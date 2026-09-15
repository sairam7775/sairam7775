/** The tools without the model: what Bento Man's hands can do, and what
 *  they refuse to. Every scenario here is one the eval set also sends
 *  through the model; this is the half that must hold regardless. */
import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store.memory";
import { runTool, TOOLS, type ToolContext } from "../tools";
import { ProposalSchema } from "../diff";
import { buildContext } from "../context";
import { SYSTEM_PROMPT, voiceLint } from "../prompt";

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
    expect(r.cities.map((c: { tier: string }) => c.tier)).toEqual(["deep", "deep", "deep", "outline", "deep"]);
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
    expect(r.result).toMatch(/Takayama is at stub tier/);
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
    expect(r.matches[0]).toMatchObject({ id: "kyt-fushimi-inari", verified: true, cost_jpy: 0 });
    expect(r.matches[0].duration_min.typical).toBe(90);
    expect(r.matches[0].crowd_note).toMatch(/shuffling queue/);
  });
  it("get_place says when nothing matches", async () => {
    const r = parse(await runTool("get_place", { query: "Skytree" }, ctxFor(new MemoryStore())));
    expect(r.matches).toEqual([]);
    expect(r.note).toMatch(/don't have it/);
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
    expect(text).toMatch(/Kyoto \(kyoto-city, deep, 41 verified\)/);
    expect(text).not.toMatch(/Takayama \(/);
  });
});
