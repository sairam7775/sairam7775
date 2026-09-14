"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";

const TIERS = ["deep", "outline", "stub"] as const;

const tierChange = z.object({
  cityId: z.string().min(1),
  tier: z.enum(TIERS),
});

/** Coverage tier is a promise to the traveller, so it is not a free-form
 *  field. Deep tier means the planner will build whole days here, which it
 *  has no business doing off a handful of records. */
const MIN_VERIFIED_FOR = { deep: 25, outline: 8, stub: 0 } as const;

export async function setCoverageTier(formData: FormData) {
  const { db } = await requireAdmin();

  const parsed = tierChange.safeParse({
    cityId: formData.get("cityId"),
    tier: formData.get("tier"),
  });
  if (!parsed.success) return;

  const { cityId, tier } = parsed.data;

  const { count } = await db
    .from("places")
    .select("id", { count: "exact", head: true })
    .eq("city_id", cityId)
    .eq("verification_status", "verified");

  const verified = count ?? 0;
  const required = MIN_VERIFIED_FOR[tier];

  if (verified < required) {
    redirect(
      `/admin/cities/${cityId}?error=` +
        encodeURIComponent(
          `${tier} tier needs at least ${required} verified places. This city has ${verified}.`,
        ),
    );
  }

  await db.from("cities").update({ coverage_tier: tier }).eq("id", cityId);
  revalidatePath(`/admin/cities/${cityId}`);
  revalidatePath("/admin");
}

const newPlace = z.object({
  id: z
    .string()
    .trim()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "Ids are lowercase letters, numbers and hyphens."),
  cityId: z.string().min(1),
  name: z.string().trim().min(1),
  nameJa: z.string().trim().optional(),
  category: z.string().trim().min(1),
});

export async function createPlace(formData: FormData) {
  const { db } = await requireAdmin();

  const parsed = newPlace.safeParse({
    id: formData.get("id"),
    cityId: formData.get("cityId"),
    name: formData.get("name"),
    nameJa: formData.get("nameJa") || undefined,
    category: formData.get("category"),
  });

  if (!parsed.success) {
    redirect(
      `/admin/cities/${formData.get("cityId")}?error=` +
        encodeURIComponent(parsed.error.issues[0].message),
    );
  }

  const { id, cityId, name, nameJa, category } = parsed.data;

  // New records are drafts. Nothing else is possible: the database rejects
  // a verified record with no verifier.
  const { error } = await db.from("places").insert({
    id,
    city_id: cityId,
    name,
    name_ja: nameJa ?? null,
    category,
    verification_status: "draft",
  });

  if (error) {
    redirect(`/admin/cities/${cityId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/admin/cities/${cityId}`);
  redirect(`/admin/places/${id}`);
}

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const n = Number(value);
  return value === null || value === "" || Number.isNaN(n) ? null : n;
}

export async function savePlace(formData: FormData) {
  const { db } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Editing a verified record returns it to draft. Judgement fields are a
  // signed-off claim about the world; changing one withdraws the signature
  // until a human puts it back.
  const { error } = await db
    .from("places")
    .update({
      name: String(formData.get("name") ?? ""),
      name_ja: String(formData.get("nameJa") ?? "") || null,
      category: String(formData.get("category") ?? ""),
      interest_tags: formData.getAll("interestTags").map(String),
      energy: numberOrNull(formData.get("energy")),
      crowd_level: numberOrNull(formData.get("crowdLevel")),
      discovery: numberOrNull(formData.get("discovery")),
      signature: numberOrNull(formData.get("signature")) ?? 0.5,
      physical_demand: numberOrNull(formData.get("physicalDemand")),

      duration_taste_min: numberOrNull(formData.get("durationTaste")),
      duration_typical_min: numberOrNull(formData.get("durationTypical")),
      duration_full_min: numberOrNull(formData.get("durationFull")),
      best_window: splitList(formData.get("bestWindow")),
      crowd_note: String(formData.get("crowdNote") ?? "") || null,
      worth_it_if: splitList(formData.get("worthItIf")),
      skip_if: splitList(formData.get("skipIf")),
      local_tip: String(formData.get("localTip") ?? "") || null,

      cost_jpy: numberOrNull(formData.get("costJpy")),
      booking_lead_days: numberOrNull(formData.get("bookingLeadDays")),
      conflicts_with: splitList(formData.get("conflictsWith")),
      pairs_with: splitList(formData.get("pairsWith")),
      sources: splitList(formData.get("sources")),

      verification_status: "draft",
      verified_by: null,
      last_verified: null,
    })
    .eq("id", id);

  if (error) {
    redirect(`/admin/places/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/admin/places/${id}`);
  redirect(`/admin/places/${id}?saved=1`);
}

/** The signature. Everything a traveller would act on becomes visible the
 *  moment this succeeds, so it is the one action in the app that needs a
 *  named human behind it. */
export async function verifyPlace(formData: FormData) {
  const { user, db } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: place } = await db
    .from("places")
    .select("duration_typical_min, interest_tags, sources")
    .eq("id", id)
    .maybeSingle();

  // A record with no duration and no tags cannot be planned with, so
  // verifying it would publish an empty promise.
  const missing: string[] = [];
  if (!place?.duration_typical_min) missing.push("a typical duration");
  if (!place?.interest_tags?.length) missing.push("at least one interest tag");
  if (!place?.sources?.length) missing.push("at least one source");

  if (missing.length) {
    redirect(
      `/admin/places/${id}?error=` +
        encodeURIComponent(`Can't verify without ${missing.join(", ")}.`),
    );
  }

  await db
    .from("places")
    .update({
      verification_status: "verified",
      verified_by: user.email ?? user.id,
      last_verified: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id);

  revalidatePath(`/admin/places/${id}`);
  redirect(`/admin/places/${id}?verified=1`);
}
