import { createClient } from "@/lib/supabase/server";
import { selectAll } from "@/lib/supabase/select-all";
import { readPoint } from "@/lib/transit/point";
import type { PlaceInput } from "./types";
import type { CoverageTier } from "@/lib/types";

/** Every place the engine may consider in a city, through the verification
 *  gate: judgement fields on unverified records arrive as NULL, which is
 *  exactly what makes them unschedulable (filter.ts). */
export async function loadPlacesForCity(cityId: string): Promise<PlaceInput[]> {
  const db = await createClient();
  const [{ data: city, error: e1 }, rows] = await Promise.all([
    db.from("cities").select("coverage_tier").eq("id", cityId).maybeSingle(),
    // Paged so the API's row limit can't silently drop places.
    selectAll((from, to) => db.from("places_public").select(PLACE_COLUMNS, { count: "exact" }).eq("city_id", cityId).order("id").range(from, to)),
  ]);
  if (e1) throw e1;
  const tier = (city?.coverage_tier ?? "stub") as CoverageTier;

  return rows.map((r) => rowToPlace(r, tier));
}

/** The places_public columns rowToPlace reads, and nothing else: every
 *  traveller-facing loader selects these rather than "*" (the view's
 *  last_verified and sources are never read). place-columns.test.ts keeps
 *  this list equal to what rowToPlace reads; a column added to the view and
 *  to rowToPlace goes here too. Every name must exist in the view, or the
 *  whole request fails: the list needs 0032, 0033 and 0035 on the database. One
 *  literal, so the client can type the rows. */
export const PLACE_COLUMNS =
  "id, city_id, name, name_ja, category, coords, nearest_station, station_walk_min, interest_tags, energy, crowd_level, discovery, signature, physical_demand, duration_taste_min, duration_typical_min, duration_full_min, best_window, crowd_note, worth_it_if, skip_if, local_tip, cost_jpy, booking_req, booking_lead_days, opens_at, closes_at, closed_weekdays, closed_dates, conflicts_with, pairs_with, verification_status, seasons, hours_vary, closed_yearly, evening_only, many_closed_weekdays";

/** A places_public row as the engine reads it. Shared with Bento Man's
 *  store so both paths read the same gate the same way. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToPlace(r: any, tier: CoverageTier): PlaceInput {
  const point = readPoint(r.coords);
  return {
    id: r.id,
    cityId: r.city_id,
    name: r.name,
    nameJa: r.name_ja ?? null,
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
    hoursVary: r.hours_vary === true,
    // The loaders name this column, so they need 0033 on the database. A
    // row without it (the shared plan's) is not evening-only.
    eveningOnly: r.evening_only === true,
    closedWeekdays: r.closed_weekdays ?? [],
    // The loaders name this column, so they need 0035 on the database. A
    // row without it (the shared plan's) has none.
    manyClosedWeekdays: r.many_closed_weekdays ?? [],
    closedDates: r.closed_dates ?? [],
    // The loaders name this column, so they need 0032 on the database. A
    // row without it (the shared plan's) has no yearly closures.
    closedYearly: r.closed_yearly ?? [],
    conflictsWith: r.conflicts_with ?? [],
    pairsWith: r.pairs_with ?? [],
    verificationStatus: r.verification_status,
    coverageTier: tier,
    nearestStation: r.nearest_station,
    stationWalkMin: r.station_walk_min,
    lat: point?.lat ?? null,
    lon: point?.lon ?? null,
    seasons: r.seasons ?? [],
    crowdNote: r.crowd_note,
    localTip: r.local_tip,
  };
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));
