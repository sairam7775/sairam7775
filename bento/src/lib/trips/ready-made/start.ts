/** Starting a trip from a ready-made one (package 1C of
 *  docs/bento/60-direction/ready-made-trips.md): the picker's answers,
 *  checked, which trips may be offered, and the start itself.
 *
 *  The start creates the trip, has the engine plan every day with the
 *  trip's must-see places pinned, and saves the route and the days through
 *  the one path a chat-built plan takes: a proposal stored with a message
 *  and applied by `applyProposal` (`apply_proposal` in the database). There
 *  is no second way to write an itinerary, and nothing calls the model.
 *
 *  Pure apart from what it is handed, so the tests run it on the memory
 *  store; the server action (trips/actions.ts) hands it the Supabase one. */
import { z } from "zod";
import { allocateDates, assessRoute, type CityFacts } from "@/lib/engine/route";
import { planTrip } from "@/lib/engine/trip";
import { travelFromGraph } from "@/lib/engine/travel";
import type { PlaceInput } from "@/lib/engine/types";
import { computeDayDiff, routeDiffFrom, type Proposal, type RouteCity } from "@/lib/bento-man/diff";
import type { TripStore } from "@/lib/bento-man/store";
import type { CoverageTier } from "@/lib/types";
import { copy } from "@/copy";
import { readyMadeTrips } from "./index";
import { readyMadeToPlan } from "./to-plan";
import type { ReadyMadeTrip, ReadyMadeTripId } from "./types";

const e = copy.readyMade.picker.errors;

export interface ReadyMadeStart {
  tripId: ReadyMadeTripId;
  startDate: string;
  people: number;
}

const TRIP_IDS = readyMadeTrips.map((t) => t.id) as [ReadyMadeTripId, ...ReadyMadeTripId[]];
const isRealDate = (s: string) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const Answers = z.object({
  tripId: z.enum(TRIP_IDS, { error: e.trip }),
  startDate: z.string({ error: e.startDate }).regex(/^\d{4}-\d{2}-\d{2}$/, e.startDate).refine(isRealDate, e.startDate),
  people: z.coerce.number().int(copy.trips.errors.wholePeople).min(1, copy.trips.errors.minPeople).max(20, copy.trips.errors.maxPeople),
});

/** The picker's form, checked: a trip on the list, a real start date
 *  (required: the engine plans closing days on real dates), and 1 to 20
 *  people. */
export function parseReadyMadeStart(form: FormData): { ok: true; value: ReadyMadeStart } | { ok: false; error: string } {
  const field = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  };
  const parsed = Answers.safeParse({ tripId: field("trip"), startDate: field("startDate"), people: field("people") ?? "1" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return { ok: true, value: parsed.data };
}

/** Every city a trip spends a day in: the route and its day trips. */
const citiesOf = (t: ReadyMadeTrip) => new Set([...t.route.map((c) => c.cityId), ...t.dayTrips.map((d) => d.cityId)]);

/** The trips that may be offered: every city they use is planned on the
 *  site (outline or deep in `city_coverage`). A city the view doesn't list
 *  counts as not planned. The rest are left out of the picker, not shown
 *  as "coming": the planner would refuse them. */
export function availableReadyMade(tiers: Map<string, CoverageTier>): ReadyMadeTrip[] {
  return readyMadeTrips.filter((t) => [...citiesOf(t)].every((id) => (tiers.get(id) ?? "stub") !== "stub"));
}

export interface ReadyMadeStartDeps {
  /** What every traveller can read: coverage from `city_coverage`, places
   *  from `places_public`, and the train graph. Read before anything is
   *  written, so a refused start writes nothing. */
  catalogue: Pick<TripStore, "cities" | "places" | "graph">;
  /** Creates the traveller's trip, under the same row caps and write
   *  allowance as any other, and returns its store. Throws with words for
   *  the traveller when the trip can't be made. */
  create: (meta: { title: string; startDate: string; endDate: string; partySize: number }) => Promise<{ id: string; store: TripStore }>;
  /** Deletes a trip whose plan couldn't be saved, so no empty half-trip is left. */
  discard: (id: string) => Promise<void>;
}

export type ReadyMadeStartResult = { ok: true; tripId: string } | { ok: false; error: string };

export async function startReadyMade(deps: ReadyMadeStartDeps, input: ReadyMadeStart): Promise<ReadyMadeStartResult> {
  const trip = readyMadeTrips.find((t) => t.id === input.tripId);
  if (!trip) return { ok: false, error: e.trip };

  // Checked again here, whatever the page offered: the page may be old, or
  // the form hand-made.
  const cities = await deps.catalogue.cities();
  const facts = new Map<string, CityFacts>(cities.map((c) => [c.id, c]));
  if (!availableReadyMade(new Map(cities.map((c) => [c.id, c.tier]))).some((t) => t.id === trip.id)) return { ok: false, error: e.notYet };

  const plan = readyMadeToPlan(trip, input.startDate);
  const placesByCity: Record<string, PlaceInput[]> = {};
  for (const id of new Set(plan.days.map((d) => d.cityId))) placesByCity[id] = await deps.catalogue.places(id);
  // A must-see that isn't public (not verified) can't be pinned: the trip
  // would come out without one of the places it is built on.
  const missing = plan.days.some((d) => (d.locked ?? []).some((l) => !placesByCity[d.cityId].some((p) => p.id === l.placeId)));
  if (missing) return { ok: false, error: e.notYet };

  const text = copy.readyMade.trips[trip.id];
  let made: { id: string; store: TripStore };
  try {
    made = await deps.create({ title: text.title, startDate: plan.startDate, endDate: plan.endDate, partySize: input.people });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : e.failed };
  }

  try {
    const [state, graph] = await Promise.all([made.store.state(), deps.catalogue.graph()]);
    const { prefs } = state;
    const planned = planTrip({
      days: plan.days,
      traveller: {
        pace: prefs.pace,
        interestTags: prefs.interestTags,
        energy: prefs.energy,
        crowdTolerance: prefs.crowdTolerance,
        discovery: prefs.discovery,
        excludes: prefs.excludes,
        mobility: prefs.mobility,
      },
      budgetByCity: {},
      placesByCity,
      travel: travelFromGraph(graph),
    });
    // Pins are never dropped by the engine; this is the proof before saving.
    plan.days.forEach((d, i) => {
      for (const l of d.locked ?? []) {
        if (!planned.days[i].items.some((it) => it.placeId === l.placeId && it.locked)) throw new Error(`${trip.id}: ${l.placeId} not kept on ${d.date}`);
      }
    });

    const assessment = assessRoute(plan.route, facts, graph, trip.days - 1);
    const dated = allocateDates(plan.startDate, plan.route, plan.endDate);
    const after: RouteCity[] = plan.route.map((c, i) => ({
      cityId: c.cityId,
      name: facts.get(c.cityId)!.name,
      nights: c.nights,
      reason: c.reason,
      budgetBand: null,
      arriveDate: dated[i].arriveDate,
      departDate: dated[i].departDate,
      tier: facts.get(c.cityId)!.tier,
    }));
    const route = routeDiffFrom([], after, assessment);
    // A new trip has no saved days, so every base is empty.
    const days = planned.days.map((d) => computeDayDiff([], d, placesByCity[d.cityId], []));
    const proposal: Proposal = { summary: `${route.summary}${copy.plan.day.join}${copy.plan.day.days(days.length)}`, route, days };

    const { id: messageId } = await made.store.append("assistant", copy.readyMade.picker.started(text.title), proposal);
    await made.store.applyProposal(proposal, messageId);
  } catch (err) {
    console.error("Starting a ready-made trip failed:", trip.id, err instanceof Error ? err.message : err);
    await deps.discard(made.id).catch((discardErr) => {
      console.error("Discarding the half-started trip failed:", made.id, discardErr instanceof Error ? discardErr.message : discardErr);
    });
    return { ok: false, error: e.failed };
  }
  return { ok: true, tripId: made.id };
}
