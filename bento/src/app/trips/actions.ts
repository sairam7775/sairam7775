"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const newTrip = z.object({
  title: z.string().trim().max(120).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  partySize: z.coerce.number().int().min(1).max(20).default(1),
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
  const { error } = await supabase.from("trips").insert({
    user_id: user.id,
    title: title ?? null,
    start_date: startDate ?? null,
    end_date: endDate ?? null,
    party_size: partySize,
  });

  if (error) {
    redirect(`/trips?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/trips");
  redirect("/trips");
}

export async function deleteTrip(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // No user check needed: RLS will not delete a row this user doesn't own.
  await supabase.from("trips").delete().eq("id", id);
  revalidatePath("/trips");
}
