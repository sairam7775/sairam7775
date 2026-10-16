"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { buildTripView } from "@/lib/bento-man/trip-view";
import { bookingDates, canPlanOn } from "@/lib/vault/plan-day";
import { dbErrorMessage } from "@/lib/friendly-errors";

/** Putting a booking in a day's box, and taking it out. The booking itself
 *  stays in the vault either way; only `planned_on` changes. Called from the
 *  Bookings column (a drop, or "Add to this day"), so they return a message
 *  instead of redirecting. */

const Place = z.object({ tripId: z.string().uuid(), bookingId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
const Remove = z.object({ tripId: z.string().uuid(), bookingId: z.string().uuid() });

const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

export async function planBooking(input: { tripId: string; bookingId: string; date: string }): Promise<{ error?: string }> {
  const parsed = Place.safeParse(input);
  if (!parsed.success) return { error: "That booking or day isn't right. Reload the page and try again." };
  const { tripId, bookingId, date } = parsed.data;

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in again to change your plan." };

  const { data: b, error } = await db.from("bookings").select("id, title, starts_at, ends_at").eq("id", bookingId).eq("trip_id", tripId).maybeSingle();
  if (error) return { error: dbErrorMessage(error, "add the booking") };
  if (!b) return { error: "That booking isn't in this trip any more." };

  // The date rule, before anything is written. The database checks it too.
  const booking = { startsAt: b.starts_at, endsAt: b.ends_at };
  if (!booking.startsAt) return { error: `“${b.title}” has no date yet. Add one in Bookings, then put it in its day.` };
  if (!canPlanOn(booking, date)) {
    const r = bookingDates(booking)!;
    const when = r.first === r.last ? `is for ${fmt(r.first)}` : `runs ${fmt(r.first)} – ${fmt(r.last)}`;
    return { error: `“${b.title}” ${when}, so it can't go in ${fmt(date)}.` };
  }

  // And only on a day the plan has.
  let days: string[];
  try {
    days = buildTripView(await new SupabaseStore(db, tripId, user.id).state(), null).dayList.map(([d]) => d);
  } catch {
    return { error: "That trip couldn't be loaded. Reload the page and try again." };
  }
  if (!days.includes(date)) return { error: `${fmt(date)} isn't one of this trip's days.` };

  const res = await db.from("bookings").update({ planned_on: date }).eq("id", bookingId).eq("trip_id", tripId);
  if (res.error) return { error: dbErrorMessage(res.error, "add the booking") };
  revalidatePath(`/trips/${tripId}`);
  return {};
}

export async function unplanBooking(input: { tripId: string; bookingId: string }): Promise<{ error?: string }> {
  const parsed = Remove.safeParse(input);
  if (!parsed.success) return { error: "That booking isn't right. Reload the page and try again." };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "You're signed out. Sign in again to change your plan." };
  const res = await db.from("bookings").update({ planned_on: null }).eq("id", parsed.data.bookingId).eq("trip_id", parsed.data.tripId);
  if (res.error) return { error: dbErrorMessage(res.error, "take the booking out") };
  revalidatePath(`/trips/${parsed.data.tripId}`);
  return {};
}
