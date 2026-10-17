"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/friendly-errors";
import { canEncrypt, encryptRef } from "@/lib/vault/crypto";
import { endsBeforeStarts, hasTime, isWallTime, stamp } from "@/lib/vault/wall-time";
import { canPlanOn } from "@/lib/vault/plan-day";
import type { BookingKind } from "@/lib/types";
import { copy } from "@/copy";

/** The vault's writes. Nothing here is fetched from an airline or a hotel:
 *  every field is the traveller's own, typed or pasted. */

const KINDS = ["flight", "accommodation", "transport", "activity", "restaurant", "other"] as const;

const e = copy.vault.errors;

const wallTime = (which: "start" | "end") =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || isWallTime(v), e.badDate(which));

const BookingForm = z.object({
  tripId: z.string().uuid(),
  id: z.string().uuid().optional(),
  type: z.enum(KINDS),
  title: z.string().trim().min(1, e.noTitle).max(160, e.tooLong),
  provider: z.string().trim().max(120, e.tooLong).optional(),
  reference: z.string().trim().max(60, e.tooLong).optional(),
  startsAt: wallTime("start").optional(),
  endsAt: wallTime("end").optional(),
  cityId: z.string().trim().max(60).optional(),
  toCityId: z.string().trim().max(60).optional(),
  placeId: z.string().trim().max(80).optional(),
  costAmount: z.string().trim().max(20, e.tooLong).optional(),
  costCurrency: z.string().trim().max(3, e.tooLong).optional(),
  notes: z.string().trim().max(600, e.tooLong).optional(),
});

export async function saveBooking(formData: FormData) {
  const { db, tripId, data } = await guard(formData, BookingForm);

  if (endsBeforeStarts(data.startsAt, data.endsAt)) {
    back(tripId, e.endsBeforeStarts);
  }

  // A missing key must not lose the booking: everything else is saved and
  // the traveller is told the reference could not be held.
  let referenceEncrypted: string | null = null;
  let warning: string | null = null;
  if (data.reference) {
    if (canEncrypt()) referenceEncrypted = encryptRef(data.reference);
    else {
      // Never log the reference itself.
      console.error("Booking reference not saved: BENTO_BOOKING_REF_KEY is missing or invalid.");
      warning = e.savedWithoutReference;
    }
  }

  const amount = data.costAmount ? Number(data.costAmount) : null;
  const row = {
    trip_id: tripId,
    type: data.type as BookingKind,
    title: data.title,
    provider: data.provider || null,
    starts_at: stamp(data.startsAt),
    ends_at: stamp(data.endsAt),
    // A date with no time is stored at 00:00 and marked unknown (0018), so
    // it is shown as the date alone, never as midnight.
    starts_time_known: !data.startsAt || hasTime(data.startsAt),
    ends_time_known: !data.endsAt || hasTime(data.endsAt),
    city_id: data.cityId || null,
    to_city_id: data.toCityId || null,
    place_id: data.placeId || null,
    cost_amount: Number.isFinite(amount) ? amount : null,
    cost_currency: data.costCurrency ? data.costCurrency.toUpperCase() : null,
    // Costs are stored in JPY; a non-JPY amount keeps its own currency and
    // is converted on read against fx_rates (`vaultTotal`).
    cost_jpy: data.costCurrency?.toUpperCase() === "JPY" && Number.isFinite(amount) ? Math.round(amount!) : null,
    notes: data.notes || null,
    ...(referenceEncrypted ? { reference_encrypted: referenceEncrypted } : {}),
  };

  // A booking sits in a day's box only on a date it covers (0017). New
  // dates that no longer cover that day take it out of the box, rather than
  // failing the save.
  let unplan = false;
  if (data.id) {
    const { data: was } = await db.from("bookings").select("planned_on").eq("id", data.id).eq("trip_id", tripId).maybeSingle();
    unplan = Boolean(was?.planned_on) && !canPlanOn({ startsAt: row.starts_at, endsAt: row.ends_at }, was!.planned_on!);
  }

  const res = data.id
    ? await db.from("bookings").update(unplan ? { ...row, planned_on: null } : row).eq("id", data.id).eq("trip_id", tripId)
    : await db.from("bookings").insert(row);
  if (res.error) back(tripId, dbErrorMessage(res.error, e.doingSave));

  revalidatePath(`/trips/${tripId}/vault`);
  revalidatePath(`/trips/${tripId}`);
  // The kind and whether it came from a paste ride along for the analytics
  // event the next page records (TrackOnce), which removes them again.
  const done = new URLSearchParams({ ...(warning ? { warning } : { saved: "1" }), kind: data.type, ...(formData.get("fromPaste") === "1" ? { pasted: "1" } : {}) });
  redirect(`/trips/${tripId}/vault?${done}`);
}

export async function deleteBooking(formData: FormData) {
  const { db, tripId, data } = await guard(formData, z.object({ tripId: z.string().uuid(), id: z.string().uuid() }));
  const { error } = await db.from("bookings").delete().eq("id", data.id).eq("trip_id", tripId);
  if (error) back(tripId, dbErrorMessage(error, e.doingDelete));
  revalidatePath(`/trips/${tripId}/vault`);
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}/vault`);
}

/** "We are taking the night bus." A gap the traveller has seen and chosen
 *  to live with stops being raised, but is never deleted — they can undo. */
export async function dismissGap(formData: FormData) {
  const { db, tripId, data } = await guard(formData, z.object({ tripId: z.string().uuid(), gapKey: z.string().min(1).max(200), note: z.string().trim().max(200).optional() }));
  const { error } = await db.from("gap_dismissals").upsert({ trip_id: tripId, gap_key: data.gapKey, note: data.note || null }, { onConflict: "trip_id,gap_key" });
  if (error) back(tripId, dbErrorMessage(error, e.doingList));
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
