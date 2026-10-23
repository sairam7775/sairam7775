"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { checkBackgroundText } from "@/lib/places/backgrounds";

const BACK = "/admin/backgrounds";
const to = (params: Record<string, string>) => `${BACK}?${new URLSearchParams(params)}`;

const placeId = z.string().min(1).regex(/^[a-z0-9-]+$/, "Ids are lowercase letters, numbers and hyphens.");
const edit = z.object({
  placeId,
  body: z.string().trim().superRefine((value, ctx) => {
    const refused = checkBackgroundText(value);
    if (refused) ctx.addIssue({ code: "custom", message: refused });
  }),
  sources: z.string().nullable()
    .transform((value) => (value ?? "").split(",").map((s) => s.trim()).filter(Boolean))
    .pipe(z.array(z.string()).min(1, "A background needs at least one source.")),
});

/** Writes a background as a draft, from scratch or over an earlier one.
 *  Saving a checked background sends it back to draft: changed words are
 *  checked again before a traveller sees them, as with places. */
export async function saveBackground(formData: FormData) {
  const { user, db } = await requireAdmin();
  const parsed = edit.safeParse({ placeId: formData.get("placeId"), body: formData.get("body") ?? "", sources: formData.get("sources") });
  if (!parsed.success) redirect(to({ error: parsed.error.issues[0].message }));
  const { placeId: id, body, sources } = parsed.data;

  const { error } = await db.from("place_backgrounds").upsert(
    { place_id: id, body, sources, status: "draft", drafted_by: user.email ?? user.id, verified_by: null, verified_on: null, updated_at: new Date().toISOString() },
    { onConflict: "place_id" },
  );
  if (error) redirect(to({ error: `Couldn't save ${id}: ${error.message}` }));
  revalidatePath(BACK);
  redirect(to({ saved: id }));
}

/** The signature: from here the background reaches travellers (through
 *  place_backgrounds_public, once the place itself is verified). Only a
 *  draft is signed, so an edit saved meanwhile is never signed unseen. */
export async function approveBackground(formData: FormData) {
  const { user, db } = await requireAdmin();
  const id = placeId.safeParse(formData.get("placeId"));
  if (!id.success) redirect(to({ error: id.error.issues[0].message }));

  const { data, error } = await db
    .from("place_backgrounds")
    .update({ status: "verified", verified_by: user.email ?? user.id, verified_on: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() })
    .eq("place_id", id.data)
    .eq("status", "draft")
    .select("place_id");
  if (error) redirect(to({ error: `Couldn't approve ${id.data}: ${error.message}` }));
  if (!data?.length) redirect(to({ error: `${id.data} wasn't a draft any more. Check it again.` }));
  revalidatePath(BACK);
  redirect(to({ approved: id.data }));
}
