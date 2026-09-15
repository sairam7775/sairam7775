/** Bento Man's tools — the only way the model touches the trip.
 *
 *  Each tool is a thin call into the engine or the store. The model picks
 *  the tool and narrates the result; the numbers in the result are the
 *  engine's. Anything that changes the plan produces a Proposal on the
 *  turn's context, which the traveller accepts or rejects (§08). Nothing
 *  here writes an itinerary. */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { planDay } from "@/lib/engine/schedule";
import { travelFromGraph } from "@/lib/engine/travel";
import { allocateDates, assessRoute, hubFor, suggestRoute, type CityFacts, type RouteAssessment } from "@/lib/engine/route";
import type { LockedItem, PlaceInput, TravellerInput } from "@/lib/engine/types";
import { placeRoute, route } from "@/lib/transit/graph";
import { describeRoute } from "@/lib/transit/describe";
import { INTEREST_TAGS, type BudgetBand } from "@/lib/types";
import { clock, computeDayDiff, mergeProposals, routeDiffFrom, type Proposal, type RouteCity } from "./diff";
import { nightsBetween, type Prefs, type TripState, type TripStore } from "./store";

export interface ToolContext {
  store: TripStore;
  /** "YYYY-MM-DD" */
  today: string;
  /** Accumulates across the turn; persisted on the assistant message. */
  proposal: Proposal | null;
}

export interface ToolOutcome {
  result: string;
  isError?: boolean;
}

const TAG_IDS = INTEREST_TAGS.map((t) => t.id) as [string, ...string[]];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^\d{2}:\d{2}$/;
const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ---------------------------------------------------------------- schemas

const SetPreferences = z.object({
  pace: z.enum(["relaxed", "standard", "packed"]).optional(),
  interest_tags: z.array(z.enum(TAG_IDS)).optional(),
  energy: z.number().min(0).max(1).optional(),
  crowd_tolerance: z.number().min(0).max(1).optional(),
  discovery: z.number().min(0).max(1).optional(),
  excludes: z.array(z.string()).optional(),
  mobility: z.array(z.string()).optional(),
  dietary: z.array(z.string()).optional(),
  display_currency: z.string().length(3).optional(),
});

const SetTripDates = z.object({
  start_date: z.string().regex(ISO_DATE).optional(),
  end_date: z.string().regex(ISO_DATE).optional(),
  party_size: z.number().int().min(1).max(20).optional(),
  title: z.string().max(120).optional(),
});

const RouteCities = z.array(z.object({ city_id: z.string(), nights: z.number().int().min(0).max(30) })).min(1).max(8);

const AssessRoute = z.object({ cities: RouteCities });

const ProposeRoute = z.object({
  cities: z
    .array(
      z.object({
        city_id: z.string(),
        nights: z.number().int().min(0).max(30),
        reason: z.string().max(240),
        budget_band: z.enum(["budget", "mid", "comfortable"]).optional(),
      }),
    )
    .min(1)
    .max(8),
});

const SuggestRoute = z.object({ nights: z.number().int().min(1).max(30).optional() });

const PlanDays = z.object({
  dates: z.array(z.object({ date: z.string().regex(ISO_DATE), city_id: z.string().optional() })).max(14).optional(),
});

const ReplanDay = z.object({
  date: z.string().regex(ISO_DATE),
  ops: z
    .array(
      z.object({
        op: z.enum(["pin", "unpin", "remove", "add", "avoid_category", "start_at"]),
        place_id: z.string().optional(),
        time: z.string().regex(HHMM).optional(),
        category: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

const GetPlace = z.object({ query: z.string().min(1).max(80), city_id: z.string().optional() });

const RouteBetween = z.object({ from: z.string().min(1), to: z.string().min(1) });

// ------------------------------------------------------------ definitions

/** Order is stable on purpose: the tool list is part of the cached prefix. */
export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "set_preferences",
    description:
      "Save what the traveller has told you about how they like to travel. Call once you have a few answers; every field is optional and later calls merge. energy: 0 sit and look, 1 all-day effort. crowd_tolerance: 0 will get up at 6am to avoid crowds, 1 crowds don't matter. discovery: 0 the famous things, 1 what visitors miss. excludes are hard filters — 'beaches', 'hiking', a category or tag the traveller never wants. mobility: e.g. 'limited_mobility', 'stroller'.",
    input_schema: {
      type: "object",
      properties: {
        pace: { type: "string", enum: ["relaxed", "standard", "packed"] },
        interest_tags: { type: "array", items: { type: "string", enum: TAG_IDS } },
        energy: { type: "number", minimum: 0, maximum: 1 },
        crowd_tolerance: { type: "number", minimum: 0, maximum: 1 },
        discovery: { type: "number", minimum: 0, maximum: 1 },
        excludes: { type: "array", items: { type: "string" } },
        mobility: { type: "array", items: { type: "string" } },
        dietary: { type: "array", items: { type: "string" } },
        display_currency: { type: "string", description: "ISO 4217, e.g. GBP" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "set_trip_dates",
    description: "Set the trip's dates, party size or title. Dates are YYYY-MM-DD. Nights are derived from the dates.",
    input_schema: {
      type: "object",
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
        party_size: { type: "integer", minimum: 1, maximum: 20 },
        title: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "assess_route",
    description:
      "Check a list of cities with nights each, in travel order. Returns the coverage tier per city, the train time between them, the share of the trip spent moving, and a verdict: fine, tight or overpacked, with the arithmetic to show the traveller. Call this before proposing or endorsing any route. Does not change anything.",
    input_schema: {
      type: "object",
      properties: {
        cities: {
          type: "array",
          items: {
            type: "object",
            properties: { city_id: { type: "string" }, nights: { type: "integer", minimum: 0 } },
            required: ["city_id", "nights"],
            additionalProperties: false,
          },
        },
      },
      required: ["cities"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_route",
    description:
      "Propose the trip's cities and nights, in travel order, with a one-line reason each. Creates a proposal the traveller accepts or rejects in the interface — it is not applied by this call. A city with 0 nights is a day trip or an en-route stop. Assess first; if the verdict is overpacked, tell the traveller and propose the cut instead.",
    input_schema: {
      type: "object",
      properties: {
        cities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              city_id: { type: "string" },
              nights: { type: "integer", minimum: 0 },
              reason: { type: "string" },
              budget_band: { type: "string", enum: ["budget", "mid", "comfortable"] },
            },
            required: ["city_id", "nights", "reason"],
            additionalProperties: false,
          },
        },
      },
      required: ["cities"],
      additionalProperties: false,
    },
  },
  {
    name: "suggest_route",
    description:
      "Bento's starting route for the corridor it knows, for the trip's number of nights (or the nights given). Returns cities with nights and reasons plus the assessment. Use it when the traveller has no route in mind.",
    input_schema: {
      type: "object",
      properties: { nights: { type: "integer", minimum: 1, maximum: 30 } },
      additionalProperties: false,
    },
  },
  {
    name: "plan_days",
    description:
      "Build day plans with the engine. With no dates, plans every empty day of the accepted route. With dates, plans those days — give city_id to plan a day trip (e.g. Nara from Kyoto). Returns each day as the engine built it, with the reason per stop, what was left out and why, and warnings. Creates a proposal; it is not applied by this call.",
    input_schema: {
      type: "object",
      properties: {
        dates: {
          type: "array",
          items: {
            type: "object",
            properties: { date: { type: "string" }, city_id: { type: "string" } },
            required: ["date"],
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "replan_day",
    description:
      "Change one planned day with the smallest operations that express what the traveller said, then let the engine re-plan around what is kept. ops: pin (place_id, optional time HH:MM) fixes a place, optionally at a time; unpin releases it; remove drops a place from this day; add brings a place in; avoid_category (category) keeps a category out of this day, e.g. 'temple'; start_at (time) starts the day later or earlier. Pinned items already in the day stay pinned. Creates a proposal.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string" },
        ops: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: ["pin", "unpin", "remove", "add", "avoid_category", "start_at"] },
              place_id: { type: "string" },
              time: { type: "string", description: "HH:MM" },
              category: { type: "string" },
            },
            required: ["op"],
            additionalProperties: false,
          },
        },
      },
      required: ["date", "ops"],
      additionalProperties: false,
    },
  },
  {
    name: "get_place",
    description:
      "Look up a place by name or id — the verified facts: durations, the quiet window, crowd note, tip, cost, hours, closed days, booking, nearest station. Use before describing a place. Returns up to five matches; judgement fields are absent on records nobody has verified yet.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" }, city_id: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "route_between",
    description:
      "The journey between two stations or two places (station ids or place ids), as a traveller can follow it: lines, stops, minutes, fare, changes, and the notes that trip people up. Use before describing how to get somewhere.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
];

// ---------------------------------------------------------------- helpers

const j = (v: unknown) => JSON.stringify(v);

function travellerFor(prefs: Prefs, budgetBand: BudgetBand | null): TravellerInput {
  return {
    pace: prefs.pace,
    interestTags: prefs.interestTags,
    energy: prefs.energy,
    crowdTolerance: prefs.crowdTolerance,
    discovery: prefs.discovery,
    excludes: prefs.excludes,
    mobility: prefs.mobility,
    budgetBand,
  };
}

function factsMap(cities: CityFacts[]): Map<string, CityFacts> {
  return new Map(cities.map((c) => [c.id, c]));
}

/** Every date of the trip with the city it is spent in, from the accepted route. */
function plannedDates(state: TripState): Map<string, string> {
  const out = new Map<string, string>();
  const sorted = [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const c of allocateDates(state.trip.startDate, sorted, state.trip.endDate)) {
    for (const d of c.dates) out.set(d, c.cityId);
  }
  // A day the traveller already has in the itinerary keeps its city.
  for (const d of state.days) if (d.cityId) out.set(d.date, d.cityId);
  return out;
}

function compactAssessment(a: RouteAssessment) {
  return {
    verdict: a.verdict,
    arithmetic: a.arithmetic,
    reasons: a.reasons,
    nights_mismatch: a.nightsMismatch,
    cities: a.cities.map((c) => ({ city_id: c.cityId, name: c.name, nights: c.nights, tier: c.tier, verified_places: c.verifiedPlaces, bento: c.planning })),
    legs: a.legs.map((l) => ({ from: l.fromCityId, to: l.toCityId, minutes: l.minutes, fare: l.fareJpy == null ? null : `${l.fareKind === "exact" ? "" : "~"}¥${l.fareJpy}`, summary: l.summary, lines: l.lines })),
  };
}

function placeFacts(p: PlaceInput) {
  const verified = p.verificationStatus === "verified";
  const base = {
    id: p.id,
    name: p.name,
    city_id: p.cityId,
    category: p.category,
    tags: p.interestTags,
    city_tier: p.coverageTier,
    verified,
    cost_jpy: p.costJpy,
    hours: p.opensAt ? `${p.opensAt}–${p.closesAt}` : "always open",
    closed: p.closedWeekdays.length ? p.closedWeekdays.map((d) => WEEKDAY[d]).join(", ") : null,
    booking: p.bookingReq === "none" ? null : `${p.bookingReq}${p.bookingLeadDays ? `, about ${p.bookingLeadDays} days ahead` : ""}`,
    station: p.nearestStation ? `${p.nearestStation} · ${p.stationWalkMin ?? "?"} min walk` : "no station on record",
  };
  if (!verified) return { ...base, note: "unverified — durations, windows and tips are hidden until a human signs this record off" };
  return {
    ...base,
    duration_min: { taste: p.durationTasteMin, typical: p.durationTypicalMin, full: p.durationFullMin },
    best_window: p.bestWindow,
    crowd_note: p.crowdNote,
    tip: p.localTip,
    skip_if: p.skipIf,
    conflicts_with: p.conflictsWith,
    pairs_with: p.pairsWith,
    seasons: p.seasons ?? [],
  };
}

function routeCitiesFrom(state: TripState): RouteCity[] {
  return [...state.cities]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((c) => ({ cityId: c.cityId, name: c.name, nights: c.nights, reason: c.reason, budgetBand: c.budgetBand, arriveDate: c.arriveDate, departDate: c.departDate, tier: c.tier }));
}

function parseHHMM(t: string | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function dayNarration(d: ReturnType<typeof computeDayDiff>) {
  return {
    date: d.date,
    city_id: d.cityId,
    summary: d.summary,
    stops: d.after.map((it) => ({
      time: `${clock(it.startMin)}–${clock(it.endMin)}`,
      name: it.name,
      place_id: it.placeId,
      change: it.change,
      pinned: it.locked || undefined,
      reason: it.reason,
      arrive: it.arriveDetail ?? undefined,
    })),
    removed: d.removed.map((r) => r.name),
    left_out: d.considered.slice(0, 6).map((c) => `${c.name}: ${c.detail}`),
    warnings: d.warnings,
    active: `${Math.floor(d.activeMin / 60)}h ${d.activeMin % 60}m of ${d.budgetMin / 60}h`,
    cost: `${d.fareKind === "exact" ? "" : "~"}¥${d.costJpy}`,
  };
}

export type ReplanOp = z.infer<typeof ReplanDay>["ops"][number];

/** One day re-planned around the traveller's pins and the given ops. Used
 *  by the replan_day tool and by the "re-plan this day" button, so a hand
 *  edit and a spoken one go through the same engine call. */
export async function replanDay(store: TripStore, date: string, ops: ReplanOp[]): Promise<{ diff: ReturnType<typeof computeDayDiff> } | { error: string }> {
  const [state, cities, graph] = await Promise.all([store.state(), store.cities(), store.graph()]);
  const existing = state.days.find((d) => d.date === date);
  const cityId = existing?.cityId ?? plannedDates(state).get(date);
  if (!cityId) return { error: `${date} is not a day of this trip` };
  const f = factsMap(cities).get(cityId);
  if (!f || f.tier === "stub") return { error: `${f?.name ?? cityId} is at stub tier — Bento can't plan days there yet` };

  const all = await store.places(cityId);
  const byId = new Map(all.map((x) => [x.id, x]));
  const lockedMap = new Map<string, LockedItem>((existing?.items ?? []).filter((i) => i.locked).map((i) => [i.placeId, { placeId: i.placeId, startMin: i.startMin }]));
  const excluded = new Set<string>();
  const avoidCategories = new Set<string>();
  let dayStartMin: number | undefined;
  for (const op of ops) {
    if (["pin", "unpin", "remove", "add"].includes(op.op)) {
      if (!op.place_id) return { error: `${op.op} needs place_id` };
      if (!byId.has(op.place_id)) return { error: `no place ${op.place_id} in ${f.name} — use get_place to find the id` };
    }
    switch (op.op) {
      case "pin":
      case "add":
        lockedMap.set(op.place_id!, { placeId: op.place_id!, startMin: parseHHMM(op.time) });
        excluded.delete(op.place_id!);
        break;
      case "unpin":
        lockedMap.delete(op.place_id!);
        break;
      case "remove":
        lockedMap.delete(op.place_id!);
        excluded.add(op.place_id!);
        break;
      case "avoid_category":
        if (!op.category) return { error: "avoid_category needs category" };
        avoidCategories.add(op.category.toLowerCase());
        break;
      case "start_at": {
        const m = parseHHMM(op.time);
        if (m == null) return { error: "start_at needs time HH:MM" };
        dayStartMin = m;
        break;
      }
    }
  }
  const pool = all.filter((x) => !excluded.has(x.id) && !(avoidCategories.has(x.category.toLowerCase()) && !lockedMap.has(x.id)));
  const used = new Set(state.days.filter((d) => d.date !== date).flatMap((d) => d.items.map((i) => i.placeId)));
  const budget = state.cities.find((c) => c.cityId === cityId)?.budgetBand ?? null;
  const plan = planDay({
    date,
    cityId,
    places: pool,
    traveller: travellerFor(state.prefs, budget),
    travel: travelFromGraph(graph),
    locked: [...lockedMap.values()],
    usedPlaceIds: [...used],
    dayStartMin,
  });
  return { diff: computeDayDiff((existing?.items ?? []).map((i) => ({ placeId: i.placeId, name: i.name, sortOrder: i.sortOrder, startMin: i.startMin, locked: i.locked })), plan) };
}

// ------------------------------------------------------------------ run

export async function runTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const fail = (msg: string): ToolOutcome => ({ result: msg, isError: true });
  const { store } = ctx;

  switch (name) {
    case "set_preferences": {
      const p = SetPreferences.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const i = p.data;
      const prefs = await store.savePreferences({
        pace: i.pace,
        interestTags: i.interest_tags as Prefs["interestTags"] | undefined,
        energy: i.energy,
        crowdTolerance: i.crowd_tolerance,
        discovery: i.discovery,
        excludes: i.excludes,
        mobility: i.mobility,
        dietary: i.dietary,
        displayCurrency: i.display_currency?.toUpperCase(),
      });
      return { result: j({ saved: true, preferences: prefs }) };
    }

    case "set_trip_dates": {
      const p = SetTripDates.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const i = p.data;
      const current = (await store.state()).trip;
      const start = i.start_date ?? current.startDate;
      const end = i.end_date ?? current.endDate;
      if (start && end && end < start) return fail("end_date is before start_date");
      const trip = await store.setTripDates({ startDate: i.start_date, endDate: i.end_date, partySize: i.party_size, title: i.title });
      return { result: j({ saved: true, trip, nights: nightsBetween(trip.startDate, trip.endDate) }) };
    }

    case "assess_route": {
      const p = AssessRoute.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const [state, cities, graph] = await Promise.all([store.state(), store.cities(), store.graph()]);
      const facts = factsMap(cities);
      const unknown = p.data.cities.filter((c) => !facts.has(c.city_id)).map((c) => c.city_id);
      if (unknown.length) return fail(`unknown city id(s): ${unknown.join(", ")}. Known ids: ${cities.map((c) => c.id).join(", ")}`);
      const a = assessRoute(p.data.cities.map((c) => ({ cityId: c.city_id, nights: c.nights })), facts, graph, nightsBetween(state.trip.startDate, state.trip.endDate));
      return { result: j(compactAssessment(a)) };
    }

    case "propose_route": {
      const p = ProposeRoute.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const [state, cities, graph] = await Promise.all([store.state(), store.cities(), store.graph()]);
      const facts = factsMap(cities);
      const unknown = p.data.cities.filter((c) => !facts.has(c.city_id)).map((c) => c.city_id);
      if (unknown.length) return fail(`unknown city id(s): ${unknown.join(", ")}`);
      const input = p.data.cities.map((c) => ({ cityId: c.city_id, nights: c.nights }));
      const a = assessRoute(input, facts, graph, nightsBetween(state.trip.startDate, state.trip.endDate));
      const dated = allocateDates(state.trip.startDate, input, state.trip.endDate);
      const after: RouteCity[] = p.data.cities.map((c, i) => ({
        cityId: c.city_id,
        name: facts.get(c.city_id)!.name,
        nights: c.nights,
        reason: c.reason,
        budgetBand: c.budget_band ?? null,
        arriveDate: dated[i].arriveDate,
        departDate: dated[i].departDate,
        tier: facts.get(c.city_id)!.tier,
      }));
      const routeDiff = routeDiffFrom(routeCitiesFrom(state), after, a);
      ctx.proposal = mergeProposals(ctx.proposal, { summary: routeDiff.summary, route: routeDiff, days: [] });
      return { result: j({ proposed: true, note: "The traveller sees this as a proposal with accept and reject. Nothing is applied yet.", assessment: compactAssessment(a) }) };
    }

    case "suggest_route": {
      const p = SuggestRoute.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const [state, cities, graph] = await Promise.all([store.state(), store.cities(), store.graph()]);
      const nights = p.data.nights ?? nightsBetween(state.trip.startDate, state.trip.endDate);
      if (!nights) return fail("the trip has no dates yet — ask for dates or pass nights");
      const s = suggestRoute(nights, state.prefs.interestTags);
      const facts = factsMap(cities);
      const a = assessRoute(s.cities, facts, graph, nights);
      return {
        result: j({
          note: s.note,
          cities: s.cities.map((c) => ({ city_id: c.cityId, name: facts.get(c.cityId)?.name ?? c.cityId, nights: c.nights, reason: c.reason, tier: facts.get(c.cityId)?.tier ?? "stub" })),
          assessment: compactAssessment(a),
        }),
      };
    }

    case "plan_days": {
      const p = PlanDays.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const [state, cities, graph] = await Promise.all([store.state(), store.cities(), store.graph()]);
      if (!state.trip.startDate) return fail("the trip has no start date yet — set dates first");
      const facts = factsMap(cities);
      const byDate = plannedDates(state);
      let targets: { date: string; cityId: string }[];
      if (p.data.dates?.length) {
        targets = [];
        for (const d of p.data.dates) {
          const cityId = d.city_id ?? byDate.get(d.date);
          if (!cityId) return fail(`${d.date} is not in the accepted route and no city_id was given`);
          if (!facts.has(cityId)) return fail(`unknown city id: ${cityId}`);
          targets.push({ date: d.date, cityId });
        }
      } else {
        const existing = new Map(state.days.map((d) => [d.date, d]));
        targets = [...byDate.entries()].filter(([date]) => !(existing.get(date)?.items.length)).map(([date, cityId]) => ({ date, cityId }));
        if (!targets.length) return fail(state.cities.length ? "every day already has a plan — use replan_day with dates to change one" : "no accepted route yet — propose a route first");
      }
      targets.sort((x, y) => x.date.localeCompare(y.date));

      const travel = travelFromGraph(graph);
      const placesCache = new Map<string, PlaceInput[]>();
      const targetDates = new Set(targets.map((t) => t.date));
      const used = new Set(state.days.filter((d) => !targetDates.has(d.date)).flatMap((d) => d.items.map((i) => i.placeId)));
      const days = [];
      const skipped: string[] = [];
      for (const t of targets) {
        const f = facts.get(t.cityId)!;
        if (f.tier === "stub") {
          skipped.push(`${t.date}: ${f.name} is at stub tier — Bento doesn't know it well enough yet to plan a day there`);
          continue;
        }
        if (!placesCache.has(t.cityId)) placesCache.set(t.cityId, await store.places(t.cityId));
        const existing = state.days.find((d) => d.date === t.date);
        const locked: LockedItem[] = (existing?.items ?? []).filter((i) => i.locked).map((i) => ({ placeId: i.placeId, startMin: i.startMin }));
        const budget = state.cities.find((c) => c.cityId === t.cityId)?.budgetBand ?? null;
        const plan = planDay({
          date: t.date,
          cityId: t.cityId,
          places: placesCache.get(t.cityId)!,
          traveller: travellerFor(state.prefs, budget),
          travel,
          locked,
          usedPlaceIds: [...used],
        });
        for (const it of plan.items) used.add(it.placeId);
        days.push(computeDayDiff((existing?.items ?? []).map((i) => ({ placeId: i.placeId, name: i.name, sortOrder: i.sortOrder, startMin: i.startMin, locked: i.locked })), plan));
      }
      if (!days.length) return fail(skipped.join("; ") || "nothing to plan");
      ctx.proposal = mergeProposals(ctx.proposal, { summary: `${days.length} day${days.length === 1 ? "" : "s"}`, days });
      return { result: j({ proposed: true, note: "Shown to the traveller as a proposal with accept and reject. Not applied yet.", days: days.map(dayNarration), skipped }) };
    }

    case "replan_day": {
      const p = ReplanDay.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const r = await replanDay(store, p.data.date, p.data.ops);
      if ("error" in r) return fail(r.error);
      ctx.proposal = mergeProposals(ctx.proposal, { summary: `${p.data.date} re-planned`, days: [r.diff] });
      return { result: j({ proposed: true, note: "Shown as a proposal; not applied yet.", day: dayNarration(r.diff) }) };
    }

    case "get_place": {

      const p = GetPlace.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const matches = await store.searchPlaces(p.data.query, p.data.city_id ?? null);
      if (!matches.length) return { result: j({ matches: [], note: "nothing in the database matches — say you don't have it rather than guessing" }) };
      return { result: j({ matches: matches.slice(0, 5).map(placeFacts) }) };
    }

    case "route_between": {
      const p = RouteBetween.safeParse(rawInput);
      if (!p.success) return fail(`invalid input: ${p.error.issues[0].message}`);
      const graph = await store.graph();
      const resolve = async (key: string): Promise<{ stationId: string; walkMin: number; label: string } | null> => {
        if (graph.stations.has(key)) return { stationId: key, walkMin: 0, label: graph.stations.get(key)!.name };
        const hits = await store.searchPlaces(key, null);
        const exact = hits.find((h) => h.id === key) ?? hits[0];
        if (exact?.nearestStation) return { stationId: exact.nearestStation, walkMin: exact.stationWalkMin ?? 10, label: exact.name };
        const hub = hubFor(key, graph);
        if (hub) return { stationId: hub, walkMin: 0, label: graph.stations.get(hub)!.name };
        return null;
      };
      const [a, b] = await Promise.all([resolve(p.data.from), resolve(p.data.to)]);
      if (!a) return fail(`can't place "${p.data.from}" — not a station id, place id, or city id in the graph`);
      if (!b) return fail(`can't place "${p.data.to}" — not a station id, place id, or city id in the graph`);
      const r = a.walkMin || b.walkMin ? placeRoute(graph, a, b) : route(graph, a.stationId, b.stationId);
      if (!r) return { result: j({ route: null, note: `no route in the graph between ${a.label} and ${b.label} — say you can't give the journey yet` }) };
      const d = describeRoute(r);
      return { result: j({ from: a.label, to: b.label, summary: d.summary, legs: d.lines, walk_in: a.walkMin || undefined, walk_out: b.walkMin || undefined }) };
    }

    default:
      return fail(`unknown tool ${name}`);
  }
}
