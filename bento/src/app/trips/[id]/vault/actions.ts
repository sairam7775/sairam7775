"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { canEncrypt, encryptRef } from "@/lib/vault/crypto";
import type { BookingKind } from "@/lib/types";

/** The vault's writes. Nothing here is fetched from an airline or a hotel:
 *  every field is the traveller's own, typed or pasted. */

const KINDS = ["flight", "accommodation", "transport", "activity", "restaurant", "other"] as const;

const BookingForm = z.object({
  tripId: z.string().uuid(),
  id: z.string().uuid().optional(),
  type: z.enum(KINDS),
  title: z.string().trim().min(1).max(160),
  provider: z.string().trim().max(120).optional(),
  reference: z.string().trim().max(60).optional(),
  startsAt: z.string().trim().max(32).optional(),
  endsAt: z.string().trim().max(32).optional(),
  cityId: z.string().trim().max(60).optional(),
  toCityId: z.string().trim().max(60).optional(),
  placeId: z.string().trim().max(80).optional(),
  costAmount: z.string().trim().max(20).optional(),
  costCurrency: z.string().trim().max(3).optional(),
  notes: z.string().trim().max(600).optional(),
});

const stamp = (s: string | undefined) => (s ? new Date(s).toISOString() : null);

export async function saveBooking(formData: FormData) {
  const { db, tripId, data } = await guard(formData, BookingForm);

  if (data.startsAt && data.endsAt && new Date(data.endsAt) < new Date(data.startsAt)) {
    back(tripId, "That booking ends before it starts.");
  }

  // A missing key must not lose the booking: everything else is saved and
  // the traveller is told the reference could not be held.
  let referenceEncrypted: string | null = null;
  let warning: string | null = null;
  if (data.reference) {
    if (canEncrypt()) referenceEncrypted = encryptRef(data.reference);
    else warning = "Saved, but not the reference: this server has no BENTO_BOOKING_REF_KEY, and a reference is never stored unencrypted.";
  }

  const amount = data.costAmount ? Number(data.costAmount) : null;
  const row = {
    trip_id: tripId,
    type: data.type as BookingKind,
    title: data.title,
    provider: data.provider || null,
    starts_at: stamp(data.startsAt),
    ends_at: stamp(data.endsAt),
    city_id: data.cityId || null,
    to_city_id: data.toCityId || null,
    place_id: data.placeId || null,
    cost_amount: Number.isFinite(amount) ? amount : null,
    cost_currency: data.costCurrency ? data.costCurrency.toUpperCase() : null,
    // Costs are stored in JPY; a non-JPY amount keeps its own currency and
    // is converted on read once fx_rates is wired (P8 follow-up).
    cost_jpy: data.costCurrency?.toUpperCase() === "JPY" && Number.isFinite(amount) ? Math.round(amount!) : null,
    notes: data.notes || null,
    ...(referenceEncrypted ? { reference_encrypted: referenceEncrypted } : {}),
  };

  const res = data.id
    ? await db.from("bookings").update(row).eq("id", data.id).eq("trip_id", tripId)
    : await db.from("bookings").insert(row);
  if (res.error) back(tripId, res.error.message);

  revalidatePath(`/trips/${tripId}/vault`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}/vault${warning ? `?warning=${encodeURIComponent(warning)}` : "?saved=1"}`);
}

export async function deleteBooking(formData: FormData) {
  const { db, tripId, data } = await guard(formData, z.object({ tripId: z.string().uuid(), id: z.string().uuid() }));
  const { error } = await db.from("bookings").delete().eq("id", data.id).eq("trip_id", tripId);
  if (error) back(tripId, error.message);
  revalidatePath(`/trips/${tripId}/vault`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}/vault`);
}

/** "We are taking the night bus." A gap the traveller has seen and chosen
 *  to live with stops being raised, but is never deleted — they can undo. */
export async function dismissGap(formData: FormData) {
  const { db, tripId, data } = await guard(formData, z.object({ tripId: z.string().uuid(), gapKey: z.string().min(1).max(200), note: z.string().trim().max(200).optional() }));
  const { error } = await db.from("gap_dismissals").upsert({ trip_id: tripId, gap_key: data.gapKey, note: data.note || null }, { onConflict: "trip_id,gap_key" });
  if (error) back(tripId, error.message);
  revalidatePath(`/trips/${tripId}/vault`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}/vault`);
}

export async function restoreGap(formData: FormData) {
  const { db, tripId, data } = await guard(formData, z.object({ tripId: z.string().uuid(), gapKey: z.string().min(1).max(200) }));
  await db.from("gap_dismissals").delete().eq("trip_id", tripId).eq("gap_key", data.gapKey);
  revalidatePath(`/trips/${tripId}/vault`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}/vault`);
}

// ------------------------------------------------------------------ inner

async function guard<T extends z.ZodType<{ tripId: string }>>(formData: FormData, schema: T): Promise<{ db: Awaited<ReturnType<typeof createClient>>; tripId: string; data: z.infer<T> }> {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");

  const raw = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, typeof v === "string" ? v : undefined]));
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const tripId = typeof raw.tripId === "string" ? raw.tripId : "";
    back(tripId, parsed.error.issues[0].message);
  }
  const data = parsed.data as z.infer<T>;

  // RLS would refuse a trip that is not theirs, but failing here gives a
  // sentence rather than a silent no-op.
  const { data: trip } = await db.from("trips").select("id").eq("id", data.tripId).maybeSingle();
  if (!trip) redirect("/trips");

  return { db, tripId: data.tripId, data };
}

function back(tripId: string, message: string): never {
  redirect(`/trips/${tripId}/vault?error=${encodeURIComponent(message)}`);
}
