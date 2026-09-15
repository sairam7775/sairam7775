import { createClient } from "@/lib/supabase/server";
import type { PlaceInput } from "./types";
import type { CoverageTier } from "@/lib/types";

/** Every place the engine may consider in a city, through the verification
 *  gate: judgement fields on unverified records arrive as NULL, which is
 *  exactly what makes them unschedulable (filter.ts). */
export async function loadPlacesForCity(cityId: string): Promise<PlaceInput[]> {
  const db = await createClient();
  const [{ data: city, error: e1 }, { data: rows, error: e2 }] = await Promise.all([
    db.from("cities").select("coverage_tier").eq("id", cityId).maybeSingle(),
    db.from("places_public").select("*").eq("city_id", cityId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const tier = (city?.coverage_tier ?? "stub") as CoverageTier;

  return (rows ?? []).map((r) => ({
    id: r.id,
    cityId: r.city_id,
    name: r.name,
    category: r.category,
    interestTags: r.interest_tags ?? [],
    energy: num(r.energy),
    crowdLevel: num(r.crowd_level),
    discovery: num(r.discovery),
    signature: num(r.signature) ?? 0.5,
    physicalDemand: num(r.physical_demand),
    durationTasteMin: r.duration_taste_min,
    durationTypicalMin: r.duration_typical_min,
    durationFullMin: r.duration_full_min,
    bestWindow: r.best_window ?? [],
    skipIf: r.skip_if ?? [],
    worthItIf: r.worth_it_if ?? [],
    costJpy: r.cost_jpy,
    bookingReq: r.booking_req ?? "none",
    bookingLeadDays: r.booking_lead_days,
    opensAt: r.opens_at ? String(r.opens_at).slice(0, 5) : null,
    closesAt: r.closes_at ? String(r.closes_at).slice(0, 5) : null,
    closedWeekdays: r.closed_weekdays ?? [],
    closedDates: r.closed_dates ?? [],
    conflictsWith: r.conflicts_with ?? [],
    pairsWith: r.pairs_with ?? [],
    verificationStatus: r.verification_status,
    coverageTier: tier,
    nearestStation: r.nearest_station,
    stationWalkMin: r.station_walk_min,
    seasons: r.seasons ?? [],
    crowdNote: r.crowd_note,
    localTip: r.local_tip,
  }));
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));
