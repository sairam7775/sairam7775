"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { buildTripView } from "@/lib/bento-man/trip-view";
import { bookingDates, canPlanOn } from "@/lib/vault/plan-day";
import { dbErrorMessage } from "@/lib/friendly-errors";
import { copy } from "@/copy";

const t = copy.bookings;

/** Putting a booking in the plan, and taking it out. It is added from one of
 *  its own days (`planned_on` is that day, which the database checks), and
 *  then sits in every day it covers. The booking itself stays in the vault
 *  either way; only `planned_on` changes. Called from the
 *  Bookings column (a drop, or "Add to this day"), so they return a message
 *  instead of redirecting. */

const Place = z.object({ tripId: z.string().uuid(), bookingId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const Remove = z.object({ tripId: z.string().uuid(), bookingId: z.string().uuid() });

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export async function planBooking(input: { tripId: string; bookingId: string; date: string }): Promise<{ error?: string }> {
  const parsed = Place.safeParse(input);
  if (!parsed.success) return { error: t.badInput };
  const { tripId, bookingId, date } = parsed.data;

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: t.signedOut };

  const { data: b, error } = await db.from("bookings").select("id, title, starts_at, ends_at").eq("id", bookingId).eq("trip_id", tripId).maybeSingle();
  if (error) return { error: dbErrorMessage(error, t.doingAdd) };
  if (!b) return { error: t.gone };

  // The date rule, before anything is written. The database checks it too.
  const booking = { startsAt: b.starts_at, endsAt: b.ends_at };
  if (!booking.startsAt) return { error: t.undated(b.title) };
  if (!canPlanOn(booking, date)) {
    const r = bookingDates(booking)!;
    const when = r.first === r.last ? t.isFor(fmt(r.first)) : t.runs(fmt(r.first), fmt(r.last));
    return { error: t.cantGo(b.title, when, fmt(date)) };
  }

  // And only on a day the plan has.
  let days: string[];
  try {
    days = buildTripView(await new SupabaseStore(db, tripId, user.id).state(), null).dayList.map(([d]) => d);
  } catch {
    return { error: t.tripFailed };
  }
  if (!days.includes(date)) return { error: t.notATripDay(fmt(date)) };

  const res = await db.from("bookings").update({ planned_on: date }).eq("id", bookingId).eq("trip_id", tripId);
  if (res.error) return { error: dbErrorMessage(res.error, t.doingAdd) };
  revalidatePath(`/trips/${tripId}`);
  return {};
}

export async function unplanBooking(input: { tripId: string; bookingId: string }): Promise<{ error?: string }> {
  const parsed = Remove.safeParse(input);
  if (!parsed.success) return { error: t.badBooking };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: t.signedOut };
  const res = await db.from("bookings").update({ planned_on: null }).eq("id", parsed.data.bookingId).eq("trip_id", parsed.data.tripId);
  if (res.error) return { error: dbErrorMessage(res.error, t.doingRemove) };
  revalidatePath(`/trips/${parsed.data.tripId}`);
  return {};
}
