"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copy } from "@/copy";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { retimeDay } from "@/lib/engine/retime";
import { travelFromGraph } from "@/lib/engine/travel";
import { movesFor, replanDay, type ReplanFailure } from "@/lib/bento-man/tools";
import { usualDayStart } from "@/lib/engine/schedule";
import { travelDayStart } from "@/lib/engine/travel-day";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { clock } from "@/lib/bento-man/diff";
import type { DayRow, ItemRow, TripStore } from "@/lib/bento-man/store";

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
async function editDay(store: TripStore, date: string, edit: (items: ItemRow[]) => ItemRow[]): Promise<{ lifted: boolean }> {
  // Without the city list there is no move: an edit never fails on it.
  const [state, graph, cities] = await Promise.all([store.state(), store.graph(), store.cities().catch(() => null)]);
  const day = state.days.find((d) => d.date === date);
  if (!day || !day.cityId) return { lifted: false };
  const move = cities ? movesFor(state, graph, new Map(cities.map((c) => [c.id, c])))(date, day.cityId) : undefined;
  const items = edit(day.items);
  const places = new Map((await store.places(day.cityId)).map((p) => [p.id, p]));
  const starts = day.items.map((i) => i.startMin).filter((m): m is number => m != null);
  // The same rule as a re-plan: a travel day never starts before the move.
  const kept = starts.length ? Math.min(...starts) : null;
  const dayStart = travelDayStart(kept, usualDayStart(state.prefs.crowdTolerance), move);

  const timed = retimeDay({
    items: items.map((i) => ({
      placeId: i.placeId,
      durationMin: i.durationMin ?? places.get(i.placeId)?.durationTypicalMin ?? 60,
      locked: i.locked,
      startMin: i.locked ? i.startMin : null,
    })),
    places,
    travel: travelFromGraph(graph),
    pace: state.prefs.pace,
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
  return { lifted: move != null && kept != null && dayStart > kept };
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
