/** A trip shared by link (0020): what shared_trip() returns, read into the
 *  same inputs the download uses, so a companion sees exactly the plan the
 *  traveller would download. Anything that doesn't match the shape is
 *  refused whole rather than shown in part. */
import { z } from "zod";
import { DEFAULT_PREFS, type TripState } from "@/lib/bento-man/store";
import { rowToPlace } from "@/lib/engine/load";
import type { PlaceInput } from "@/lib/engine/types";
import type { DocBooking } from "./plan-document";

const text = z.string().nullable();
const count = z.number().int().nullable();

export const SharedPlanSchema = z.object({
  trip: z.object({
    id: z.string(),
    title: text,
    start_date: text,
    end_date: text,
    party_size: z.number().int(),
    status: z.enum(["planning", "booked", "travelling", "done", "abandoned"]),
  }),
  pace: z.enum(["relaxed", "standard", "packed"]).nullable(),
  cities: z.array(z.object({
    city_id: z.string(),
    name: text,
    tier: z.enum(["deep", "outline", "stub"]).nullable(),
    nights: z.number().int(),
    sort_order: z.number().int(),
    arrive_date: text,
    depart_date: text,
  })),
  days: z.array(z.object({
    id: z.string(),
    date: z.string(),
    city_id: text,
    items: z.array(z.object({
      id: z.string(),
      place_id: z.string(),
      sort_order: z.number().int(),
      start_time: text,
      duration_min: count,
      reason: text,
      arrive_mode: text,
      arrive_minutes: count,
      arrive_detail: text,
    })),
  })),
  places: z.array(z.object({
    id: z.string(),
    name: z.string(),
    nearest_station: text,
    station_walk_min: count,
    opens_at: text,
    closes_at: text,
    hours_vary: z.boolean().nullable().optional(),
    crowd_note: text,
    local_tip: text,
  })),
  stations: z.array(z.object({ id: z.string(), name: z.string() })),
  bookings: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    starts_at: text,
    ends_at: text,
    starts_time_known: z.boolean().nullable(),
    ends_time_known: z.boolean().nullable(),
    planned_on: text,
  })),
});

export interface SharedPlan {
  state: TripState;
  bookings: DocBooking[];
  places: Map<string, PlaceInput>;
  stations: Map<string, { name: string }>;
}

const toMin = (t: string | null): number | null => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)) : null);

/** The shared plan, or null if there is none under that link or it isn't
 *  the expected shape. */
export function sharedPlanFromJson(v: unknown): SharedPlan | null {
  const parsed = SharedPlanSchema.safeParse(v);
  if (!parsed.success) return null;
  const s = parsed.data;
  const names = new Map(s.places.map((p) => [p.id, p.name]));
  const cityName = new Map(s.cities.map((c) => [c.city_id, c.name ?? c.city_id]));
  return {
    state: {
      trip: { id: s.trip.id, title: s.trip.title, startDate: s.trip.start_date, endDate: s.trip.end_date, partySize: s.trip.party_size, status: s.trip.status },
      // Only the pace is shared; nothing else of the traveller's preferences.
      prefs: { ...DEFAULT_PREFS, pace: s.pace ?? DEFAULT_PREFS.pace },
      cities: s.cities.map((c) => ({
        cityId: c.city_id, name: cityName.get(c.city_id)!, tier: c.tier ?? "stub", nights: c.nights, sortOrder: c.sort_order,
        budgetBand: null, reason: null, arriveDate: c.arrive_date, departDate: c.depart_date,
      })),
      days: s.days.map((d) => ({
        id: d.id,
        date: d.date,
        cityId: d.city_id,
        items: d.items.map((i) => ({
          id: i.id, placeId: i.place_id, name: names.get(i.place_id) ?? i.place_id, sortOrder: i.sort_order,
          startMin: toMin(i.start_time), durationMin: i.duration_min, locked: false, reason: i.reason, reasonTerms: [],
          arriveMode: i.arrive_mode, arriveMinutes: i.arrive_minutes, arriveDetail: i.arrive_detail,
        })),
      })),
      pendingProposal: null,
    },
    bookings: s.bookings.map((b) => ({
      id: b.id, type: b.type, title: b.title, startsAt: b.starts_at, endsAt: b.ends_at, plannedOn: b.planned_on,
      startTimeKnown: b.starts_time_known !== false, endTimeKnown: b.ends_time_known !== false,
    })),
    places: new Map(s.places.map((p) => [p.id, rowToPlace(p, "stub")])),
    stations: new Map(s.stations.map((st) => [st.id, { name: st.name }])),
  };
}
