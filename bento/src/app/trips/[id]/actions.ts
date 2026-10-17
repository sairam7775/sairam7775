"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { copy } from "@/copy";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseProposal } from "@/lib/bento-man/diff";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";

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

async function guard(formData: FormData) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");
  const parsed = Ids.safeParse({ tripId: formData.get("tripId"), messageId: formData.get("messageId") });
  if (!parsed.success) redirect("/trips");
  return { db, user, ...parsed.data };
}
