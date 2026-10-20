"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copy } from "@/copy";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseProposal } from "@/lib/bento-man/diff";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { parseReview, reviewOpen, snapshotFromRow } from "@/lib/trips/review";
import { SHARE_EXPIRY_OPTIONS, shareExpiry, type ShareExpiry, type ShareExpiryOption } from "@/lib/trips/share-expiry";
import type { TripState } from "@/lib/bento-man/store";

const Ids = z.object({ tripId: z.string().uuid(), messageId: z.string().uuid() });

/** §08: the traveller accepts a proposal; the app applies it. The model
 *  is not in this path at all. The claim on the proposal, the route, every
 *  day and the closing of older proposals are one database transaction
 *  (`apply_proposal`): a proposal is applied at most once, and a failure
 *  part-way leaves both the trip and the proposal as they were. */
export async function acceptProposal(formData: FormData) {
  const { db, user, tripId, messageId } = await guard(formData);

  const { data: msg } = await db
    .from("chat_messages")
    .select("proposed_diff")
    .eq("id", messageId)
    .eq("trip_id", tripId)
    .eq("diff_status", "proposed")
    .maybeSingle();
  if (!msg) redirect(`/trips/${tripId}?error=${encodeURIComponent(copy.trip.proposals.answered)}`);

  const proposal = parseProposal(msg.proposed_diff);
  if (!proposal) {
    await db.from("chat_messages").update({ diff_status: "rejected", resolved_at: new Date().toISOString() }).eq("id", messageId).eq("diff_status", "proposed");
    redirect(`/trips/${tripId}?error=${encodeURIComponent(copy.trip.proposals.unreadable)}`);
  }

  const store = new SupabaseStore(db, tripId, user.id);
  try {
    await store.applyProposal(proposal, messageId);
  } catch (e) {
    const why = e instanceof Error ? e.message : copy.trip.proposals.notAppliedUnknown;
    redirect(`/trips/${tripId}?error=${encodeURIComponent(copy.trip.proposals.notApplied(why))}`);
  }

  // "Don't ask me again" on a date change is the traveller's permission
  // (#6). It's a preference, not part of the trip, so it isn't in the
  // transaction above: if it fails, the dates still moved, and we say so.
  if (proposal.dates && formData.get("remember") === "on") {
    try {
      await store.setAutoApplyDates(true);
    } catch {
      redirect(`/trips/${tripId}?error=${encodeURIComponent(copy.trip.proposals.rememberFailed)}`);
    }
  }

  revalidatePath(`/trips/${tripId}`);
}

/** The traveller's answer to "may Bento Man change dates without asking?".
 *  Only this, and "don't ask again" on an accepted date change, set it. */
export async function setDatePermission(formData: FormData) {
  const parsed = z.object({ tripId: z.string().uuid(), allow: z.enum(["on", "off"]) }).safeParse({ tripId: formData.get("tripId"), allow: formData.get("allow") });
  if (!parsed.success) redirect("/trips");
  const { tripId, allow } = parsed.data;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");
  try {
    await new SupabaseStore(db, tripId, user.id).setAutoApplyDates(allow === "on");
  } catch {
    redirect(`/trips/${tripId}?error=${encodeURIComponent(copy.trip.edit.settingFailed)}`);
  }
  revalidatePath(`/trips/${tripId}`);
}

const ShareForm = z.object({
  tripId: z.string().uuid(),
  from: z.enum(["trip", "print"]).default("trip"),
  expiryOption: z.enum(SHARE_EXPIRY_OPTIONS),
});
const StopShareForm = z.object({ tripId: z.string().uuid(), from: z.enum(["trip", "print"]).default("trip") });

/** Sharing the plan by link (0020/0024). The database makes the token; a new
 *  link is the old row deleted and a fresh one inserted, so the old address
 *  stops working at once. Expiry is derived from a choice and stored trip
 *  dates, never from a timestamp sent by the browser. */
export async function shareTrip(formData: FormData) {
  await changeShare(formData, "on");
}

export async function renewShareLink(formData: FormData) {
  await changeShare(formData, "renew");
}

export async function stopSharing(formData: FormData) {
  await changeShare(formData, "off");
}

async function changeShare(formData: FormData, how: "on" | "renew" | "off") {
  const input = { tripId: formData.get("tripId"), from: formData.get("from") ?? undefined };
  let tripId: string;
  let from: "trip" | "print";
  let expiryOption: ShareExpiryOption | null = null;
  if (how === "off") {
    const parsed = StopShareForm.safeParse(input);
    if (!parsed.success) redirect("/trips");
    ({ tripId, from } = parsed.data);
  } else {
    const parsed = ShareForm.safeParse({ ...input, expiryOption: formData.get("expiryOption") });
    if (!parsed.success) redirect("/trips");
    ({ tripId, from, expiryOption } = parsed.data);
  }
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");
  const failed = `/trips/${tripId}?error=${encodeURIComponent(copy.share.failed)}#share`;
  let expiry: ShareExpiry = { expires_at: null, until_trip_end: false };
  if (how !== "off") {
    const { data: trip, error } = await db.from("trips").select("end_date").eq("id", tripId).maybeSingle();
    if (error) redirect(failed);
    if (!trip) redirect("/trips");
    if (!expiryOption) redirect("/trips");
    try {
      expiry = shareExpiry(expiryOption, trip.end_date, new Date());
    } catch {
      // A forged trip-end choice without a stored end date is refused before
      // it can delete or create a share row.
      redirect(failed);
    }
  }
  if (how !== "on") {
    const { error } = await db.from("trip_shares").delete().eq("trip_id", tripId);
    if (error) redirect(failed);
  }
  if (how !== "off") {
    const { error } = await db.from("trip_shares").insert({ trip_id: tripId, ...expiry });
    // Already shared (a second tap): the link there is stays.
    if (error && error.code !== "23505") redirect(failed);
  }
  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/print`);
  redirect(from === "print" ? `/trips/${tripId}/print` : `/trips/${tripId}?share=1#share`);
}

export async function rejectProposal(formData: FormData) {
  const { db, tripId, messageId } = await guard(formData);
  await db
    .from("chat_messages")
    .update({ diff_status: "rejected", resolved_at: new Date().toISOString() })
    .eq("id", messageId)
    .eq("trip_id", tripId)
    .eq("diff_status", "proposed");
  revalidatePath(`/trips/${tripId}`);
}

/** "How did the plan hold up?" (0019). One answer per trip, changeable;
 *  the database refuses it before the trip's last day too. */
export async function saveTripReview(formData: FormData) {
  const tripId = z.string().uuid().safeParse(formData.get("tripId"));
  if (!tripId.success) redirect("/trips");
  const id = tripId.data;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");
  const back: (error: string) => never = (error) => redirect(`/trips/${id}?error=${encodeURIComponent(error)}#review`);

  let state: TripState;
  try {
    state = await new SupabaseStore(db, id, user.id).state();
  } catch {
    redirect("/trips");
  }
  const { trip } = state;
  const today = new Date().toISOString().slice(0, 10);
  // A changed answer is about the plan saved with the first one: its days are
  // chosen from that plan's dates, and it stays changeable whatever the trip
  // does after. A first answer waits for the trip to end.
  const { data: saved } = await db.from("trip_reviews").select("plan").eq("trip_id", id).maybeSingle();
  const plan = snapshotFromRow(saved?.plan);
  if (!saved && !reviewOpen(trip, state.cities.length > 0, today)) back(copy.review.errors.notYet);
  const parsed = parseReview(formData, plan ? { startDate: plan.start, endDate: plan.end } : trip);
  if (!parsed.ok) back(parsed.error);
  const { review } = parsed;
  // The plan the answer is about is saved by the database with the first
  // answer and kept from then on (0019's trigger); the app never sends one.
  // An existing answer is updated, not upserted: an upsert is checked as an
  // insert too, which a trip moved into the future would fail.
  const answer = { outcome: review.outcome, challenges: review.challenges, hard_days: review.hardDays, note: review.note };
  let { error } = saved
    ? await db.from("trip_reviews").update(answer).eq("trip_id", id)
    : await db.from("trip_reviews").insert({ trip_id: id, ...answer });
  // Two first answers at once: the other made the row; this one updates it.
  if (error?.code === "23505") ({ error } = await db.from("trip_reviews").update(answer).eq("trip_id", id));
  if (error) back(copy.review.errors.saveFailed);

  revalidatePath(`/trips/${id}`);
  revalidatePath("/trips");
  // Counts only, for analytics (TrackOnce on the trip page): never the
  // answer or the note.
  const marks = new URLSearchParams({ reviewed: "1", rc: String(review.challenges.length), rd: String(review.hardDays.length), rn: review.note ? "1" : "0" });
  redirect(`/trips/${id}?${marks}#review`);
}

async function guard(formData: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");
  const parsed = Ids.safeParse({ tripId: formData.get("tripId"), messageId: formData.get("messageId") });
  if (!parsed.success) redirect("/trips");
  return { db, user, ...parsed.data };
}
