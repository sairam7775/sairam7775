"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copy } from "@/copy";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { retimeDay, type RetimeItem } from "@/lib/engine/retime";
import { travelFromGraph } from "@/lib/engine/travel";
import { fitPlace, type FitProblem } from "@/lib/engine/fit";
import type { PlaceInput, TravelFn, TravelMove } from "@/lib/engine/types";
import { movesFor, plannedDates, replanDay, travellerFor, type ReplanFailure } from "@/lib/bento-man/tools";
import { usualDayStart } from "@/lib/engine/schedule";
import { travelDayStart } from "@/lib/engine/travel-day";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { clock } from "@/lib/bento-man/diff";
import { OutcomeUnknownError, type DayRow, type ItemRow, type TripState, type TripStore } from "@/lib/bento-man/store";
import { bookedPlaceIds } from "@/lib/vault/match";

/** The traveller's own edits to a day. They apply at once — drag, pin,
 *  remove are decisions, not suggestions — and the engine re-times the
 *  day so the clock never goes stale. "Re-plan this day" is the one
 *  action here that produces a proposal instead, because there the engine
 *  is choosing, and the traveller gets to say no (§08). */

const Base = z.object({ tripId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const WithPlace = Base.extend({ placeId: z.string().min(1) });

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export async function reorderDay(formData: FormData) {
  const { store, tripId, date } = await guard(formData);
  const order = z.array(z.string()).safeParse(JSON.parse(String(formData.get("order") ?? "[]")));
  if (!order.success) redirect(`/trips/${tripId}?day=${date}`);
  const edited = await editDay(store, date, (items) => {
    const byId = new Map(items.map((i) => [i.placeId, i]));
    const kept = order.data.map((id) => byId.get(id)).filter((i): i is ItemRow => Boolean(i));
    const missing = items.filter((i) => !order.data.includes(i.placeId));
    return [...kept, ...missing];
  });
  done(tripId, date, edited);
}

export async function moveItem(formData: FormData) {
  const { store, tripId, date, placeId } = await guardPlace(formData);
  const dir = formData.get("dir") === "up" ? -1 : 1;
  const edited = await editDay(store, date, (items) => {
    const i = items.findIndex((x) => x.placeId === placeId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return items;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  done(tripId, date, edited);
}

export async function togglePin(formData: FormData) {
  const { store, tripId, date, placeId } = await guardPlace(formData);
  const edited = await editDay(store, date, (items) =>
    items.map((it) => (it.placeId === placeId ? { ...it, locked: !it.locked } : it)),
  );
  done(tripId, date, edited);
}

export async function removeItem(formData: FormData) {
  const { store, tripId, date, placeId } = await guardPlace(formData);
  const edited = await editDay(store, date, (items) => items.filter((it) => it.placeId !== placeId));
  done(tripId, date, edited);
}

/** The engine re-plans the day around what is pinned; the result is a
 *  proposal in the conversation, same as if Bento Man had been asked. */
export async function replanDayAction(formData: FormData) {
  const { store, tripId, date } = await guard(formData);
  const state = await store.state();
  const day = state.days.find((d) => d.date === date);
  const pinned = (day?.items ?? []).filter((i) => i.locked);
  // With no pins, no ops: replanDay keeps the first stop's start itself
  // (and on a travel day, never before the move lets the traveller arrive).
  const ops = pinned.map((i) => ({ op: "pin" as const, place_id: i.placeId, time: i.startMin == null ? undefined : clock(i.startMin) }));
  const r = await replanDay(store, date, ops);
  // r.error is written for Bento Man (ids, tool calls): the page says why in
  // its own words.
  if ("error" in r) redirect(`/trips/${tripId}?day=${date}&error=${encodeURIComponent(replanError(r))}`);
  await store.append("assistant", copy.trip.replan.message(fmt(date), pinned.length, r.diff.summary), { summary: copy.trip.replan.summary(fmt(date)), days: [r.diff] });
  done(tripId, date);
}

// ------------------------------------------------------------------ inner

function replanError(r: ReplanFailure): string {
  const t = copy.trip.replan.errors;
  switch (r.reason) {
    case "not-a-day": return t.notADay;
    case "not-covered": return t.notCovered(r.city);
    case "unknown-place": return t.placeGone;
    default: return t.failed;
  }
}

/** Re-times the day after an edit. Returns whether a kept start was lifted
 *  to the travel day's arrival, so the page can say so. */
async function editDay(store: TripStore, date: string, edit: (items: ItemRow[]) => ItemRow[], read?: DayClock | null): Promise<{ lifted: boolean; day?: DayRow }> {
  const ctx = read === undefined ? await dayClock(store, date) : read;
  if (!ctx) return { lifted: false };
  const { day, places, move, kept, dayStart } = ctx;
  const items = edit(day.items);

  const timed = retimeDay({
    items: retimeItems(items, places),
    places,
    travel: ctx.travel,
    pace: ctx.state.prefs.pace,
    dayStartMin: dayStart,
  });

  const next: DayRow = {
    ...day,
    items: timed.items.map((t, idx) => {
      const src = items.find((i) => i.placeId === t.placeId)!;
      return {
        ...src,
        sortOrder: idx,
        startMin: t.startMin,
        durationMin: t.durationMin,
        arriveMode: t.arriveBy?.mode ?? null,
        arriveMinutes: t.arriveBy?.minutes ?? null,
        arriveDetail: t.arriveBy?.detail ?? null,
      };
    }),
  };
  await store.saveDay(next);
  return { lifted: move != null && kept != null && dayStart > kept, day: next };
}

interface DayClock {
  state: TripState;
  day: DayRow;
  places: Map<string, PlaceInput>;
  travel: TravelFn;
  move: TravelMove | undefined;
  /** The day's saved first start, which an edit keeps. */
  kept: number | null;
  dayStart: number;
}

/** What re-timing a day reads: its stops, its city's places, the trains,
 *  and the start an edit keeps. One read, so a check of a place and the
 *  edit that adds it time the day the same way. `orNew` gives a route day
 *  with nothing saved yet an empty day, so a first stop can be added. */
async function dayClock(store: TripStore, date: string, orNew = false): Promise<DayClock | null> {
  // Without the city list there is no move: an edit never fails on it.
  const [state, graph, cities] = await Promise.all([store.state(), store.graph(), store.cities().catch(() => null)]);
  const saved = state.days.find((d) => d.date === date);
  const routeCity = orNew && !saved ? plannedDates(state).get(date) : undefined;
  const day: DayRow | undefined = saved ?? (routeCity ? { date, cityId: routeCity, items: [] } : undefined);
  if (!day || !day.cityId) return null;
  const move = cities ? movesFor(state, graph, new Map(cities.map((c) => [c.id, c])))(date, day.cityId) : undefined;
  const places = new Map((await store.places(day.cityId)).map((p) => [p.id, p]));
  const starts = day.items.map((i) => i.startMin).filter((m): m is number => m != null);
  // The same rule as a re-plan: a travel day never starts before the move.
  const kept = starts.length ? Math.min(...starts) : null;
  const dayStart = travelDayStart(kept, usualDayStart(state.prefs.crowdTolerance), move);
  return { state, day, places, travel: travelFromGraph(graph, { mobility: state.prefs.mobility }), move, kept, dayStart };
}

/** A day's stops as the re-timer takes them: a pin keeps its time. */
function retimeItems(items: ItemRow[], places: Map<string, PlaceInput>): RetimeItem[] {
  return items.map((i) => ({
    placeId: i.placeId,
    durationMin: i.durationMin ?? places.get(i.placeId)?.durationTypicalMin ?? 60,
    locked: i.locked,
    startMin: i.locked ? i.startMin : null,
  }));
}

/** Back to the day. `lifted` adds a key, never words: the page says it
 *  from its own data (`copy.plan.warnings.liftedStart`). */
function done(tripId: string, date: string, edited?: { lifted: boolean }) {
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?day=${date}${edited?.lifted ? "&note=start-lifted" : ""}`);
}

async function guard(formData: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");
  const parsed = Base.safeParse({ tripId: formData.get("tripId"), date: formData.get("date") });
  if (!parsed.success) redirect("/trips");
  return { db, user, store: new SupabaseStore(db, parsed.data.tripId, user.id), ...parsed.data };
}

async function guardPlace(formData: FormData) {
  const base = await guard(formData);
  const parsed = WithPlace.safeParse({ tripId: base.tripId, date: base.date, placeId: formData.get("placeId") });
  if (!parsed.success) redirect(`/trips/${base.tripId}`);
  return { ...base, placeId: parsed.data.placeId };
}

// ------------------------------------------------------- add a place

/** One of Bento's places the traveller can add to a day: its city's
 *  verified places, as `places_public` gives them. */
export interface DayPlaceOption {
  id: string;
  name: string;
  nameJa: string | null;
  category: string;
  /** Already one of this day's stops. */
  onDay: boolean;
}

export type AddPlaceResult =
  | { status: "added"; name: string; startMin: number | null; fits: boolean; praise: string[]; problems: FitProblem[]; notes: string[]; lifted: boolean }
  | { status: "doesnt-fit"; name: string; startMin: number; problems: FitProblem[]; notes: string[] }
  | { status: "error"; error: string };

const AddPlace = Base.extend({ placeId: z.string().min(1).max(120), anyway: z.boolean().default(false) });
const ad = copy.day.addPlace;

/** The places "Add a place" searches: Bento's verified places in that day's
 *  city, read through `places_public` (never `places`). The traveller's
 *  own trip only: RLS reads no other trip's state. */
export async function placesForDay(input: { tripId: string; date: string }): Promise<{ places: DayPlaceOption[] } | { error: string }> {
  const parsed = Base.safeParse(input);
  if (!parsed.success) return { error: ad.errors.badInput };
  const signedIn = await signedInStore(parsed.data.tripId);
  if ("error" in signedIn) return signedIn;
  try {
    const state = await signedIn.store.state();
    const day = state.days.find((d) => d.date === parsed.data.date);
    const cityId = day?.cityId ?? plannedDates(state).get(parsed.data.date);
    if (!cityId) return { error: ad.errors.notADay };
    const onDay = new Set((day?.items ?? []).map((i) => i.placeId));
    const places = (await signedIn.store.places(cityId))
      .filter((p) => p.verificationStatus === "verified")
      .sort((a, b) => b.signature - a.signature || a.name.localeCompare(b.name))
      .map((p) => ({ id: p.id, name: p.name, nameJa: p.nameJa ?? null, category: p.category, onDay: onDay.has(p.id) }));
    return { places };
  } catch {
    return { error: ad.errors.failed };
  }
}

/** "Add a place": checks the place against the day in the engine
 *  (`fitPlace`), then adds it where it fits best. When it doesn't fit, it
 *  says why and adds nothing, unless the traveller asked to add it anyway;
 *  then it goes in at the same spot and the day shows its usual warnings.
 *  Applied at once and re-timed by `retimeDay`, like every hand edit. */
export async function addPlaceToDay(input: { tripId: string; date: string; placeId: string; anyway?: boolean }): Promise<AddPlaceResult> {
  const parsed = AddPlace.safeParse(input);
  if (!parsed.success) return { status: "error", error: ad.errors.badInput };
  const { tripId, date, placeId, anyway } = parsed.data;
  const signedIn = await signedInStore(tripId);
  if ("error" in signedIn) return { status: "error", error: signedIn.error };
  const { store } = signedIn;

  try {
    const ctx = await dayClock(store, date, true);
    if (!ctx) return { status: "error", error: ad.errors.notADay };
    const { state, day, places } = ctx;
    const tier = day.city?.tier ?? state.cities.find((c) => c.cityId === day.cityId)?.tier ?? (await store.cities()).find((c) => c.id === day.cityId)?.tier;
    if (!tier || tier === "stub") return { status: "error", error: ad.errors.notCovered };
    const place = places.get(placeId);
    if (!place || place.verificationStatus !== "verified") return { status: "error", error: ad.errors.notHere };
    if (day.items.some((i) => i.placeId === placeId)) return { status: "error", error: ad.errors.alreadyHere(place.name) };

    const bookings = await store.bookings();
    const fit = fitPlace({
      date,
      place,
      items: retimeItems(day.items, places),
      places,
      travel: ctx.travel,
      traveller: travellerFor(state.prefs, state.cities.find((c) => c.cityId === day.cityId)?.budgetBand ?? null),
      dayStartMin: ctx.dayStart,
      moveMin: ctx.move?.minutes,
      bookedPlaceIds: bookedPlaceIds(bookings, [place], date),
      usedPlaceIds: state.days.filter((d) => d.date !== date).flatMap((d) => d.items.map((i) => i.placeId)),
    });
    if (!fit.fits && !anyway) return { status: "doesnt-fit", name: place.name, startMin: fit.startMin, problems: fit.problems, notes: fit.notes };

    const row: ItemRow = {
      placeId: place.id,
      name: place.name,
      mapName: place.name,
      nameJa: place.nameJa ?? null,
      sortOrder: fit.at,
      startMin: fit.item.startMin,
      durationMin: fit.item.durationMin,
      locked: fit.item.locked,
      reason: fit.reason.reason || null,
      reasonTerms: fit.reason.terms,
      arriveMode: null,
      arriveMinutes: null,
      arriveDetail: null,
    };
    const edited = await editDay(store, date, (items) => [...items.slice(0, fit.at), row, ...items.slice(fit.at)], ctx);
    revalidatePath(`/trips/${tripId}`);
    const saved = edited.day?.items.find((i) => i.placeId === place.id);
    return { status: "added", name: place.name, startMin: saved?.startMin ?? null, fits: fit.fits, praise: fit.fits ? fit.praise : [], problems: fit.problems, notes: fit.notes, lifted: edited.lifted };
  } catch (e) {
    // A write that timed out may have landed: say so, claim neither.
    if (e instanceof OutcomeUnknownError) return { status: "error", error: e.message };
    return { status: "error", error: ad.errors.failed };
  }
}

/** The signed-in traveller's store for their own trip. A client-called
 *  action returns words rather than redirecting. */
async function signedInStore(tripId: string): Promise<{ store: TripStore } | { error: string }> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: ad.errors.signedOut };
  return { store: new SupabaseStore(db, tripId, user.id) };
}
