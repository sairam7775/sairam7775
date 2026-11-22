/** The vault over Supabase. Bookings are the traveller's own data, read
 *  and written as them, so RLS is the whole access control story.
 *
 *  A reference is decrypted only here, only for its owner, and only into
 *  the value a page renders. It is never logged and never returned to
 *  anything that talks to a model. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingKind } from "@/lib/types";
import type { TripState } from "@/lib/bento-man/store";
import { detectGaps, type BookingRow, type GapCity, type GapPlace, type GapReport } from "./gaps";
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
  /** False when only a date was given: show the date, not 00:00. */
  startTimeKnown: boolean;
  endTimeKnown: boolean;
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
    .select("id, type, title, provider, reference_encrypted, starts_at, ends_at, starts_time_known, ends_time_known, city_id, to_city_id, place_id, cost_jpy, cost_amount, cost_currency, file_path, notes")
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
      startTimeKnown: b.starts_time_known !== false,
      endTimeKnown: b.ends_time_known !== false,
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

/** What the gap detector needs that a page has usually read already: the
 *  trip's dates, its route, the place ids planned on each day, its bookings
 *  and the gaps the traveller dismissed. */
export interface GapSource {
  startDate: string | null;
  endDate: string | null;
  cities: GapCity[];
  days: { date: string; placeIds: (string | null)[] }[];
  bookings: BookingRow[];
  dismissed: Iterable<string>;
}

/** The gap report from what the page already holds. Reads only the
 *  planned places' booking needs, from the gate, so a draft cannot raise a
 *  gap; a failed read leaves the ticket checks out, as before. */
export async function gapsFrom(db: SupabaseClient, src: GapSource, today: string): Promise<GapReport> {
  const placeIds = [...new Set(src.days.flatMap((d) => d.placeIds).filter(Boolean))] as string[];
  const reqs = new Map<string, { name: string; req: GapPlace["bookingReq"]; lead: number | null }>();
  if (placeIds.length) {
    const { data } = await db.from("places_public").select("id, name, booking_req, booking_lead_days").in("id", placeIds);
    for (const p of data ?? []) reqs.set(p.id, { name: p.name, req: (p.booking_req ?? "none") as GapPlace["bookingReq"], lead: p.booking_lead_days });
  }

  const places: GapPlace[] = [];
  for (const d of src.days) {
    for (const id of d.placeIds) {
      const r = id ? reqs.get(id) : null;
      if (r) places.push({ placeId: id!, name: r.name, date: d.date, bookingReq: r.req, bookingLeadDays: r.lead });
    }
  }

  return detectGaps({
    startDate: src.startDate,
    endDate: src.endDate,
    cities: src.cities.map((c) => ({ cityId: c.cityId, name: c.name, nights: c.nights, sortOrder: c.sortOrder, arriveDate: c.arriveDate, departDate: c.departDate })),
    bookings: src.bookings,
    places,
    today,
    dismissed: new Set(src.dismissed),
  });
}

/** The trip page's source: the trip store's state (dates, route, days) and
 *  the page's own bookings and dismissals reads. */
export function gapSourceOf(state: TripState, bookings: BookingRow[], dismissed: Iterable<string>): GapSource {
  return {
    startDate: state.trip.startDate,
    endDate: state.trip.endDate,
    cities: state.cities,
    days: state.days.map((d) => ({ date: d.date, placeIds: d.items.map((i) => i.placeId) })),
    bookings,
    dismissed,
  };
}

/** Columns of `trip_cities` (with the city's name) the gap detector reads. */
export const GAP_CITY_COLUMNS = "city_id, nights, sort_order, arrive_date, depart_date, cities(name)";

/** A `trip_cities` row read with `GAP_CITY_COLUMNS`, as the detector takes it. */
export function gapCityOf(c: { city_id: string; nights: number; sort_order: number; arrive_date: string | null; depart_date: string | null; cities: unknown }): GapCity {
  const city = (Array.isArray(c.cities) ? c.cities[0] : c.cities) as { name?: string } | null | undefined;
  return { cityId: c.city_id, name: city?.name ?? c.city_id, nights: c.nights, sortOrder: c.sort_order, arriveDate: c.arrive_date, departDate: c.depart_date };
}

/** A bookings row (as the database gives it) as the detector takes it. */
export function bookingRowOf(b: { id: string; type: BookingKind; title: string; starts_at: string | null; ends_at: string | null; city_id: string | null; to_city_id: string | null; place_id: string | null }): BookingRow {
  return { id: b.id, type: b.type, title: b.title, startsOn: dayOf(b.starts_at), endsOn: dayOf(b.ends_at), cityId: b.city_id, toCityId: b.to_city_id, placeId: b.place_id };
}

/** A vault booking (already read for the list) as the detector takes it. */
export function bookingRowOfVault(b: VaultBooking): BookingRow {
  return { id: b.id, type: b.type, title: b.title, startsOn: dayOf(b.startsAt), endsOn: dayOf(b.endsAt), cityId: b.cityId, toCityId: b.toCityId, placeId: b.placeId };
}
