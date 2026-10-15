"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/friendly-errors";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";

const newTrip = z.object({
  title: z.string().trim().max(120, "Keep the trip name under 120 characters.").optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  partySize: z.coerce.number().int("People travelling should be a whole number.").min(1, "At least one person is travelling.").max(20, "Bento plans for up to 20 people."),
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
    redirect("/trips?error=" + encodeURIComponent("The end date is before the start date."));
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
    redirect(`/trips?error=${encodeURIComponent(dbErrorMessage(error, "create the trip"))}`);
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
  } catch (e) {
    redirect(`${back}?error=${encodeURIComponent(e instanceof Error ? e.message : "Couldn't save the trip.")}`);
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
