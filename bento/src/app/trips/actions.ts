"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/friendly-errors";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { guidedTitle, parseGuidedStart, starterMessage } from "@/lib/trips/guided-start";
import type { PrefsPatch } from "@/lib/bento-man/store";
import { copy } from "@/copy";

const e = copy.trips.errors;

export type GuidedStartState = { ok: true; tripId: string; starter: string } | { ok: false; error: string } | null;

/** "Plan a Japan trip". Creates the trip from the answers, saves the pace and
 *  interests as the traveller's preferences (so Bento Man doesn't ask them
 *  again), and hands back a first message for the chat box. Nothing is sent
 *  to Bento Man here: the traveller presses Send themselves. */
export async function startGuidedTrip(_prev: GuidedStartState, formData: FormData): Promise<GuidedStartState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const parsed = parseGuidedStart(formData);
  if (!parsed.ok) return parsed;
  const g = parsed.value;

  const { data: trip, error } = await supabase.from("trips").insert({
    user_id: user.id,
    title: guidedTitle(g),
    start_date: g.startDate,
    end_date: g.endDate,
    party_size: g.people,
  }).select("id").single();
  if (error || !trip) return { ok: false, error: dbErrorMessage(error, e.create) };

  // Preferences are a help, not the trip: if they don't save, Bento Man
  // simply asks about them, so a failure here doesn't stop anything.
  const prefs: PrefsPatch = {
    ...(g.pace ? { pace: g.pace } : {}),
    ...(g.interests.length ? { interestTags: g.interests } : {}),
  };
  if (Object.keys(prefs).length) {
    await new SupabaseStore(supabase, trip.id, user.id).savePreferences(prefs).catch((err) => {
      console.error("Saving guided-start preferences failed:", err instanceof Error ? err.message : err);
    });
  }

  revalidatePath("/trips");
  return { ok: true, tripId: trip.id, starter: starterMessage(g) };
}

const newTrip = z.object({
  title: z.string().trim().max(120, e.longTitle).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  partySize: z.coerce.number().int(e.wholePeople).min(1, e.minPeople).max(20, e.maxPeople),
});

export async function createTrip(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const parsed = newTrip.safeParse({
    title: formData.get("title") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    partySize: formData.get("partySize") || 1,
  });

  if (!parsed.success) {
    redirect(`/trips?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const { title, startDate, endDate, partySize } = parsed.data;

  if (startDate && endDate && endDate < startDate) {
    redirect("/trips?error=" + encodeURIComponent(e.endBeforeStart));
  }

  // user_id is set explicitly, and the RLS policy checks it matches the
  // caller — so a forged id fails at the database rather than here.
  const { data: trip, error } = await supabase.from("trips").insert({
    user_id: user.id,
    title: title ?? null,
    start_date: startDate ?? null,
    end_date: endDate ?? null,
    party_size: partySize,
  }).select("id").single();

  if (error || !trip) {
    redirect(`/trips?error=${encodeURIComponent(dbErrorMessage(error, e.create))}`);
  }

  // Straight into the new trip: that's where the planning starts.
  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

const tripEdit = newTrip.extend({ id: z.string().uuid() });

/** Edit a trip's name, dates or party size from the trip page. Goes through
 *  the same store method as Bento Man's set_trip_dates, so a date change
 *  closes proposals that no longer fit and re-lays the route the same way. */
export async function updateTrip(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const rawId = z.string().uuid().safeParse(formData.get("id"));
  if (!rawId.success) redirect("/trips");
  const back = `/trips/${rawId.data}`;

  const parsed = tripEdit.safeParse({
    id: rawId.data,
    title: formData.get("title") || undefined,
    startDate: formData.get("startDate") || undefined,
    endDate: formData.get("endDate") || undefined,
    partySize: formData.get("partySize") || 1,
  });
  // Stay on the trip being edited and say what was wrong.
  if (!parsed.success) redirect(`${back}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);

  const { id, title, startDate, endDate, partySize } = parsed.data;

  // RLS scopes every read and write in the store to this user's trip. The
  // store decides whether the dates really changed, and refuses a range
  // too short for the accepted route (and end-before-start) with a message.
  const store = new SupabaseStore(supabase, id, user.id);
  try {
    await store.setTripDates({ title: title ?? null, startDate: startDate ?? null, endDate: endDate ?? null, partySize });
  } catch (err) {
    redirect(`${back}?error=${encodeURIComponent(err instanceof Error ? err.message : e.saveFailed)}`);
  }

  revalidatePath(back);
  revalidatePath("/trips");
  redirect(back);
}

export async function deleteTrip(formData: FormData) {
  const parsed = z.object({ id: z.string().uuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return;
  const { id } = parsed.data;

  const supabase = await createClient();
  // No user check needed: RLS will not delete a row this user doesn't own.
  await supabase.from("trips").delete().eq("id", id);
  revalidatePath("/trips");
}
