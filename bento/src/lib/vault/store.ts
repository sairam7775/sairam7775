/** The vault over Supabase. Bookings are the traveller's own data, read
 *  and written as them, so RLS is the whole access control story.
 *
 *  A reference is decrypted only here, only for its owner, and only into
 *  the value a page renders. It is never logged and never returned to
 *  anything that talks to a model. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingKind } from "@/lib/types";
import { detectGaps, type BookingRow, type GapPlace, type GapReport } from "./gaps";
import { BookingRefError, decryptRef, maskRef } from "./crypto";

export interface VaultBooking {
  id: string;
  type: BookingKind;
  title: string;
  provider: string | null;
  /** Masked for a list: "•••4QZ". The full value is behind `reference`. */
  referenceMasked: string | null;
  /** Only populated when the caller asked to reveal it. */
  reference?: string | null;
  /** Set when the stored value could not be read. */
  referenceError: string | null;
  startsAt: string | null;
  endsAt: string | null;
  cityId: string | null;
  toCityId: string | null;
  placeId: string | null;
  costJpy: number | null;
  costAmount: number | null;
  costCurrency: string | null;
  filePath: string | null;
  notes: string | null;
}

const dayOf = (ts: string | null): string | null => (ts ? ts.slice(0, 10) : null);

export async function loadBookings(db: SupabaseClient, tripId: string, revealId?: string): Promise<VaultBooking[]> {
  const { data, error } = await db
    .from("bookings")
    .select("id, type, title, provider, reference_encrypted, starts_at, ends_at, city_id, to_city_id, place_id, cost_jpy, cost_amount, cost_currency, file_path, notes")
    .eq("trip_id", tripId)
    .order("starts_at", { nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((b) => {
    let masked: string | null = null;
    let full: string | null = null;
    let refError: string | null = null;
    if (b.reference_encrypted) {
      try {
        const plain = decryptRef(b.reference_encrypted);
        masked = maskRef(plain);
        if (revealId === b.id) full = plain;
      } catch (e) {
        refError = e instanceof BookingRefError ? e.message : "this reference could not be read";
      }
    }
    return {
      id: b.id,
      type: b.type,
      title: b.title,
      provider: b.provider,
      referenceMasked: masked,
      reference: full,
      referenceError: refError,
      startsAt: b.starts_at,
      endsAt: b.ends_at,
      cityId: b.city_id,
      toCityId: b.to_city_id,
      placeId: b.place_id,
      costJpy: b.cost_jpy,
      costAmount: b.cost_amount == null ? null : Number(b.cost_amount),
      costCurrency: b.cost_currency,
      filePath: b.file_path,
      notes: b.notes,
    };
  });
}

/** The gap report for a trip: nights from the route, tickets from the
 *  planned days, bookings from the vault. Pure detection, database reads. */
export async function loadGaps(db: SupabaseClient, tripId: string, today: string): Promise<GapReport> {
  const [trip, cityRows, dayRows, bookings, dismissals] = await Promise.all([
    db.from("trips").select("start_date, end_date").eq("id", tripId).maybeSingle(),
    db.from("trip_cities").select("city_id, nights, sort_order, arrive_date, depart_date, cities(name)").eq("trip_id", tripId).order("sort_order"),
    db.from("itinerary_days").select("date, itinerary_items(place_id)").eq("trip_id", tripId),
    db.from("bookings").select("id, type, title, starts_at, ends_at, city_id, to_city_id, place_id").eq("trip_id", tripId),
    db.from("gap_dismissals").select("gap_key").eq("trip_id", tripId),
  ]);
  if (trip.error) throw trip.error;
  if (cityRows.error) throw cityRows.error;

  // Booking requirements come from the gate, so a draft cannot raise a gap.
  const placeIds = [...new Set((dayRows.data ?? []).flatMap((d) => (d.itinerary_items ?? []).map((i) => i.place_id)).filter(Boolean))] as string[];
  const reqs = new Map<string, { name: string; req: GapPlace["bookingReq"]; lead: number | null }>();
  if (placeIds.length) {
    const { data } = await db.from("places_public").select("id, name, booking_req, booking_lead_days").in("id", placeIds);
    for (const p of data ?? []) reqs.set(p.id, { name: p.name, req: (p.booking_req ?? "none") as GapPlace["bookingReq"], lead: p.booking_lead_days });
  }

  const places: GapPlace[] = [];
  for (const d of dayRows.data ?? []) {
    for (const i of d.itinerary_items ?? []) {
      const r = i.place_id ? reqs.get(i.place_id) : null;
      if (r) places.push({ placeId: i.place_id, name: r.name, date: d.date, bookingReq: r.req, bookingLeadDays: r.lead });
    }
  }

  const rows: BookingRow[] = (bookings.data ?? []).map((b) => ({
    id: b.id,
    type: b.type,
    title: b.title,
    startsOn: dayOf(b.starts_at),
    endsOn: dayOf(b.ends_at),
    cityId: b.city_id,
    toCityId: b.to_city_id,
    placeId: b.place_id,
  }));

  return detectGaps({
    startDate: trip.data?.start_date ?? null,
    endDate: trip.data?.end_date ?? null,
    cities: (cityRows.data ?? []).map((c) => ({
      cityId: c.city_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: (c.cities as any)?.name ?? c.city_id,
      nights: c.nights,
      sortOrder: c.sort_order,
      arriveDate: c.arrive_date,
      departDate: c.depart_date,
    })),
    bookings: rows,
    places,
    today,
    dismissed: new Set((dismissals.data ?? []).map((d) => d.gap_key)),
  });
}
