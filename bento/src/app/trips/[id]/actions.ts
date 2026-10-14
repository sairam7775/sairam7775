"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseProposal } from "@/lib/bento-man/diff";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";

const Ids = z.object({ tripId: z.string().uuid(), messageId: z.string().uuid() });

/** §08: the traveller accepts a proposal; the app applies it. The model
 *  is not in this path at all. A proposal is applied at most once — the
 *  status flips in the same request, and a second click finds nothing. */
export async function acceptProposal(formData: FormData) {
  const { db, user, tripId, messageId } = await guard(formData);

  // Claim it first. The update only matches a row that is still
  // "proposed", so two submits racing each other cannot both apply — the
  // loser gets no row back.
  const now = new Date().toISOString();
  const { data: msg } = await db
    .from("chat_messages")
    .update({ diff_status: "accepted", resolved_at: now })
    .eq("id", messageId)
    .eq("trip_id", tripId)
    .eq("diff_status", "proposed")
    .select("id, proposed_diff")
    .maybeSingle();
  if (!msg) redirect(`/trips/${tripId}?error=${encodeURIComponent("That proposal has already been answered.")}`);

  const proposal = parseProposal(msg.proposed_diff);
  if (!proposal) {
    await db.from("chat_messages").update({ diff_status: "rejected" }).eq("id", messageId);
    redirect(`/trips/${tripId}?error=${encodeURIComponent("That proposal can't be read any more. Ask Bento Man again.")}`);
  }

  const store = new SupabaseStore(db, tripId, user.id);
  try {
    await store.applyProposal(proposal);
  } catch (e) {
    // Hand it back so the traveller can try again rather than losing it.
    await db.from("chat_messages").update({ diff_status: "proposed", resolved_at: null }).eq("id", messageId);
    const why = e instanceof Error ? e.message : "the database refused the change";
    redirect(`/trips/${tripId}?error=${encodeURIComponent(`That didn't apply: ${why}`)}`);
  }

  // Older proposals described a trip that no longer exists; close them.
  await db.from("chat_messages").update({ diff_status: "rejected", resolved_at: now }).eq("trip_id", tripId).eq("diff_status", "proposed");

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
