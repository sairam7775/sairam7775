"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { retimeDay } from "@/lib/engine/retime";
import { travelFromGraph } from "@/lib/engine/travel";
import { replanDay } from "@/lib/bento-man/tools";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import type { DayRow, ItemRow, TripStore } from "@/lib/bento-man/store";

/** The traveller's own edits to a day. They apply at once — drag, pin,
 *  remove are decisions, not suggestions — and the engine re-times the
 *  day so the clock never goes stale. "Re-plan this day" is the one
 *  action here that produces a proposal instead, because there the engine
 *  is choosing, and the traveller gets to say no (§08). */

const Base = z.object({ tripId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const WithPlace = Base.extend({ placeId: z.string().min(1) });

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export async function reorderDay(formData: FormData) {
  const { store, tripId, date } = await guard(formData);
  const order = z.array(z.string()).safeParse(JSON.parse(String(formData.get("order") ?? "[]")));
  if (!order.success) redirect(`/trips/${tripId}?day=${date}`);
  await editDay(store, date, (items) => {
    const byId = new Map(items.map((i) => [i.placeId, i]));
    const kept = order.data.map((id) => byId.get(id)).filter((i): i is ItemRow => Boolean(i));
    const missing = items.filter((i) => !order.data.includes(i.placeId));
    return [...kept, ...missing];
  });
  done(tripId, date);
}

export async function moveItem(formData: FormData) {
  const { store, tripId, date, placeId } = await guardPlace(formData);
  const dir = formData.get("dir") === "up" ? -1 : 1;
  await editDay(store, date, (items) => {
    const i = items.findIndex((x) => x.placeId === placeId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return items;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  done(tripId, date);
}

export async function togglePin(formData: FormData) {
  const { store, tripId, date, placeId } = await guardPlace(formData);
  await editDay(store, date, (items) =>
    items.map((it) => (it.placeId === placeId ? { ...it, locked: !it.locked } : it)),
  );
  done(tripId, date);
}

export async function removeItem(formData: FormData) {
  const { store, tripId, date, placeId } = await guardPlace(formData);
  await editDay(store, date, (items) => items.filter((it) => it.placeId !== placeId));
  done(tripId, date);
}

/** The engine re-plans the day around what is pinned; the result is a
 *  proposal in the conversation, same as if Bento Man had been asked. */
export async function replanDayAction(formData: FormData) {
  const { store, tripId, date } = await guard(formData);
  const state = await store.state();
  const day = state.days.find((d) => d.date === date);
  const pinned = (day?.items ?? []).filter((i) => i.locked);
  const ops = pinned.length
    ? pinned.map((i) => ({ op: "pin" as const, place_id: i.placeId, time: i.startMin == null ? undefined : clock(i.startMin) }))
    : [{ op: "start_at" as const, time: clock(day?.items[0]?.startMin ?? (state.prefs.crowdTolerance < 0.35 ? 7 * 60 : 9 * 60)) }];
  const r = await replanDay(store, date, ops);
  if ("error" in r) redirect(`/trips/${tripId}?day=${date}&error=${encodeURIComponent(r.error)}`);
  const kept = pinned.length ? ` around the ${pinned.length} stop${pinned.length === 1 ? "" : "s"} you pinned` : "";
  await store.append("assistant", `Re-planned ${fmt(date)}${kept}. ${r.diff.summary}. Accept it to replace the day, or reject it and keep what you have.`, { summary: `${date} re-planned`, days: [r.diff] });
  done(tripId, date);
}

// ------------------------------------------------------------------ inner

async function editDay(store: TripStore, date: string, edit: (items: ItemRow[]) => ItemRow[]) {
  const [state, graph] = await Promise.all([store.state(), store.graph()]);
  const day = state.days.find((d) => d.date === date);
  if (!day || !day.cityId) return;
  const items = edit(day.items);
  const places = new Map((await store.places(day.cityId)).map((p) => [p.id, p]));
  const starts = day.items.map((i) => i.startMin).filter((m): m is number => m != null);
  const dayStart = starts.length ? Math.min(...starts) : state.prefs.crowdTolerance < 0.35 ? 7 * 60 : 9 * 60;

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
}

function done(tripId: string, date: string) {
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?day=${date}`);
}

const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

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
