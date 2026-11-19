"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/friendly-errors";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { guidedTitle, parseGuidedStart, starterMessage } from "@/lib/trips/guided-start";
import { parseReadyMadeStart, startReadyMade, TRIP_CAP } from "@/lib/trips/ready-made/start";
import { SupabaseCatalogue } from "@/lib/trips/ready-made/catalogue";
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

/** On a refusal, what was sent comes back too: React resets the form's
 *  uncontrolled fields after an action, so the picker puts these back. */
export type ReadyMadeStartState = { ok: false; error: string; values: { trip: string; startDate: string; people: string } } | null;

/** "Start from a ready-made trip": creates the trip, saves its route and
 *  every day planned by the engine with the must-sees pinned, through the
 *  proposal path (lib/trips/ready-made/start.ts), then opens it. Nothing
 *  calls the model. Coverage is checked here again from `city_coverage`,
 *  whatever the page offered, and places come from `places_public`. */
export async function startReadyMadeTrip(_prev: ReadyMadeStartState, formData: FormData): Promise<ReadyMadeStartState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/trips/plan");

  const sent = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v.slice(0, 40) : "";
  };
  const values = { trip: sent("trip"), startDate: sent("startDate"), people: sent("people") };

  const parsed = parseReadyMadeStart(formData);
  if (!parsed.ok) return { ...parsed, values };

  const result = await startReadyMade({
    tripCount: async () => {
      // RLS: only this traveller's own trips are counted.
      const { count, error } = await supabase.from("trips").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    catalogue: new SupabaseCatalogue(supabase),
    create: async (meta) => {
      // Inserted as the traveller, like any trip: RLS, the trip cap and the
      // write allowance apply.
      const { data: trip, error } = await supabase.from("trips").insert({
        user_id: user.id,
        title: meta.title,
        start_date: meta.startDate,
        end_date: meta.endDate,
        party_size: meta.partySize,
      }).select("id").single();
      // The trip cap's own refusal (enforce_row_cap: 54000, "at most …"; the
      // write allowance shares the code, not the words), for a start that
      // passed the count while another was being made.
      if (error?.code === "54000" && error.message.startsWith("at most ")) throw new Error(copy.readyMade.picker.errors.tooManyTrips(TRIP_CAP));
      if (error || !trip) throw new Error(dbErrorMessage(error, copy.readyMade.picker.errors.create));
      return { id: trip.id, store: new SupabaseStore(supabase, trip.id, user.id) };
    },
    discard: async (id) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
    },
  }, parsed.value).catch((err) => {
    // startReadyMade catches every failure from creating the trip onwards
    // (it deletes the trip and returns a refusal), so anything thrown out
    // of it came from the reads before: the trip count, coverage, places
    // or the train graph. Nothing was written.
    console.error("Ready-made start failed before the trip was made:", err instanceof Error ? err.message : err);
    return { ok: false as const, error: copy.readyMade.picker.errors.failed };
  });
  if (!result.ok) return { ...result, values };

  revalidatePath("/trips");
  redirect(`/trips/${result.tripId}`);
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
