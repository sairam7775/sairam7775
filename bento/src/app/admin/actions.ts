"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { MAX_BULK_VERIFY, READY, missingForVerify } from "@/lib/places/verify";

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

const optionalText = z.string().nullable().transform((value) => value || null);
const list = z.string().nullable().transform((value) => (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean));

const numberOrNull = z.string().nullable().transform((value) => value === null || value === "" ? null : Number(value));
const axis = numberOrNull.pipe(z.number().min(0).max(1).nullable());
const minutes = numberOrNull.pipe(z.number().int().nonnegative().nullable());
const placeEdit = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "Ids are lowercase letters, numbers and hyphens."),
  name: z.string().min(1),
  name_ja: optionalText,
  category: z.string().min(1),
  interest_tags: z.array(z.string()),
  energy: axis,
  crowd_level: axis,
  discovery: axis,
  signature: axis.transform((value) => value ?? 0.5),
  physical_demand: axis,
  duration_taste_min: minutes,
  duration_typical_min: minutes,
  duration_full_min: minutes,
  best_window: list,
  crowd_note: optionalText,
  worth_it_if: list,
  skip_if: list,
  local_tip: optionalText,
  cost_jpy: numberOrNull.pipe(z.number().nonnegative().nullable()),
  hours_vary: z.boolean(),
  booking_lead_days: minutes,
  conflicts_with: list,
  pairs_with: list,
  sources: list,
  seasons: list,
});

export async function savePlace(formData: FormData) {
  const { db } = await requireAdmin();
  const rawId = placeEdit.shape.id.safeParse(formData.get("id"));
  if (!rawId.success) return;
  const parsed = placeEdit.safeParse({
    id: rawId.data,
    name: formData.get("name"),
    name_ja: formData.get("nameJa"),
    category: formData.get("category"),
    interest_tags: formData.getAll("interestTags"),
    energy: formData.get("energy"),
    crowd_level: formData.get("crowdLevel"),
    discovery: formData.get("discovery"),
    signature: formData.get("signature"),
    physical_demand: formData.get("physicalDemand"),
    duration_taste_min: formData.get("durationTaste"),
    duration_typical_min: formData.get("durationTypical"),
    duration_full_min: formData.get("durationFull"),
    best_window: formData.get("bestWindow"),
    crowd_note: formData.get("crowdNote"),
    worth_it_if: formData.get("worthItIf"),
    skip_if: formData.get("skipIf"),
    local_tip: formData.get("localTip"),
    cost_jpy: formData.get("costJpy"),
    hours_vary: formData.get("hoursVary") === "on",
    booking_lead_days: formData.get("bookingLeadDays"),
    conflicts_with: formData.get("conflictsWith"),
    pairs_with: formData.get("pairsWith"),
    sources: formData.get("sources"),
    seasons: formData.get("seasons"),
  });
  if (!parsed.success) {
    redirect(`/admin/places/${rawId.data}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }
  const { id, ...fields } = parsed.data;

  // Editing a verified record returns it to draft. Judgement fields are a
  // signed-off claim about the world; changing one withdraws the signature
  // until a human puts it back.
  const { error } = await db
    .from("places")
    .update({
      ...fields,
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

  const missing = missingForVerify(place);

  if (missing.length) {
    const back = String(formData.get("back") ?? "");
    const base = back.startsWith("/admin/") ? back : `/admin/places/${id}`;
    redirect(`${base}${base.includes("?") ? "&" : "?"}error=` + encodeURIComponent(`Can't verify ${id} without ${missing.join(", ")}.`));
  }

  // The rule again, in the update itself: an edit that landed after the
  // check above is signed only if it still passes.
  const { data: signed } = await db
    .from("places")
    .update({
      verification_status: "verified",
      verified_by: user.email ?? user.id,
      last_verified: new Date().toISOString().slice(0, 10),
    })
    .eq("id", id)
    .gt(...READY.durationAbove)
    .neq(...READY.tagsNot)
    .neq(...READY.sourcesNot)
    .select("id");
  if (!signed?.length) {
    const back = String(formData.get("back") ?? "");
    const base = back.startsWith("/admin/") ? back : `/admin/places/${id}`;
    redirect(`${base}${base.includes("?") ? "&" : "?"}error=` + encodeURIComponent(`${id} changed while you were reviewing it and wasn't verified. Check it again.`));
  }

  revalidatePath(`/admin/places/${id}`);
  revalidatePath("/admin/review");
  const back = String(formData.get("back") ?? "");
  redirect(back.startsWith("/admin/") ? `${back}${back.includes("?") ? "&" : "?"}verified=1` : `/admin/places/${id}?verified=1`);
}

const bulk = z.object({
  ids: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(1).max(MAX_BULK_VERIFY),
  back: z.string(),
});

/** Bulk sign-off from /admin/review/bulk. The same rule as verifyPlace,
 *  applied by the database in the one update that signs (the page's
 *  checkboxes are only a convenience): every ticked record still in draft
 *  that passes is signed by this admin; drafts that don't are named back. */
export async function verifyPlaces(formData: FormData) {
  const { user, db } = await requireAdmin();
  const rawBack = String(formData.get("back") ?? "");
  const back = rawBack.startsWith("/admin/") ? rawBack : "/admin/review/bulk";
  const to = (params: Record<string, string>) => `${back}${back.includes("?") ? "&" : "?"}${new URLSearchParams(params)}`;

  const parsed = bulk.safeParse({ ids: [...new Set(formData.getAll("ids").map(String))], back });
  if (!parsed.success) redirect(to({ error: "Tick at least one place to verify." }));

  // Check and sign in one statement, so a record edited meanwhile is
  // judged on what it holds now.
  const { data: signed, error } = await db
    .from("places")
    .update({
      verification_status: "verified",
      verified_by: user.email ?? user.id,
      last_verified: new Date().toISOString().slice(0, 10),
    })
    .in("id", parsed.data.ids)
    .eq("verification_status", "draft")
    .gt(...READY.durationAbove)
    .neq(...READY.tagsNot)
    .neq(...READY.sourcesNot)
    .select("id");
  if (error) redirect(to({ error: `Couldn't verify those places: ${error.message}` }));

  // Whatever is still a draft wasn't ready.
  const { data: left } = await db.from("places").select("id").in("id", parsed.data.ids).eq("verification_status", "draft");
  const ready = signed ?? [];
  const notReady = (left ?? []).map((r) => r.id);

  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath("/admin/review/bulk");
  redirect(to({ bulkVerified: String(ready.length), ...(notReady.length ? { notReady: notReady.join(",") } : {}) }));
}
