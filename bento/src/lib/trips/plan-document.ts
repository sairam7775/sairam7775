/** The whole trip as one document, for the download (/trips/[id]/print).
 *
 *  Pure: the accepted plan, the trip's bookings and the places' facts in;
 *  every day in order out, with its bookings and stops merged by time.
 *  Nothing here chooses or moves anything — it reads what the trip page
 *  shows. Never a booking reference: the download leaves Bento, and a
 *  reference plus a surname can cancel a booking. */
import type { TripState } from "@/lib/bento-man/store";
import type { PlaceInput } from "@/lib/engine/types";
import { bookingDates, bookingSlot, canPlanOn, type PlannableBooking } from "@/lib/vault/plan-day";
import { clock } from "@/lib/bento-man/diff";
import { copy } from "@/copy";

export interface DocBooking extends PlannableBooking {
  id: string;
  type: string;
  title: string;
  plannedOn: string | null;
}

export type DocEntry =
  | { kind: "booking"; time: string | null; end: string | null; title: string; type: string; part: "starts" | "ends" | "all-day" }
  | {
      kind: "stop";
      time: string | null;
      end: string | null;
      name: string;
      durationMin: number | null;
      /** How to get here from the stop before. */
      getThere: string | null;
      getThereMin: number | null;
      /** The nearest station or stop by name (not its id). Some are bus
       *  stops or piers, so the name is shown as the graph gives it. */
      station: string | null;
      stationWalkMin: number | null;
      hours: { opens: string; closes: string } | null;
      crowdNote: string | null;
      tip: string | null;
      why: string | null;
    };

export interface DocDay {
  date: string;
  /** 1-based, in trip order. */
  number: number;
  city: string;
  entries: DocEntry[];
}

export interface PlanDocument {
  route: { city: string; nights: number }[];
  days: DocDay[];
  /** Every booking, earliest first; ones without a date last. Times are
   *  null when only a date was given. */
  bookings: { title: string; type: string; first: string | null; last: string | null; startTime: string | null; endTime: string | null }[];
}

export function planDocument(
  state: Pick<TripState, "cities" | "days">,
  dayList: [string, { cityName: string }][],
  bookings: DocBooking[],
  places: Map<string, PlaceInput>,
  stations: Map<string, { name: string }>,
): PlanDocument {
  const planned = new Map(state.days.map((d) => [d.date, d]));

  const days = dayList.map(([date, meta], i): DocDay => {
    // As the day box does it: a booking in the plan sits in every day it covers.
    const blocks = bookings
      .filter((b) => b.plannedOn != null && canPlanOn(b, date))
      .map((b) => ({ b, slot: bookingSlot(b, date) }));
    const bookingEntries = blocks.map(({ b, slot }) => ({
      at: slot.startMin,
      entry: { kind: "booking" as const, time: slot.startMin == null ? null : clock(slot.startMin), end: slot.endMin == null ? null : clock(slot.endMin), title: b.title, type: b.type, part: slot.part },
    }));
    const stops = [...(planned.get(date)?.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const stopEntries = stops.map((it, n) => {
      const p = places.get(it.placeId);
      return {
        at: it.startMin,
        entry: {
          kind: "stop" as const,
          time: it.startMin == null ? null : clock(it.startMin),
          end: it.startMin != null && it.durationMin != null ? clock(it.startMin + it.durationMin) : null,
          // The place record loaded for this page; the stored name is the fallback.
          name: p?.name ?? it.name,
          durationMin: it.durationMin,
          getThere: n > 0 ? it.arriveDetail : null,
          getThereMin: n > 0 ? it.arriveMinutes : null,
          station: p?.nearestStation ? (stations.get(p.nearestStation)?.name ?? null) : null,
          stationWalkMin: p?.nearestStation && stations.has(p.nearestStation) ? (p.stationWalkMin ?? null) : null,
          hours: p?.opensAt && p.closesAt ? { opens: p.opensAt, closes: p.closesAt } : null,
          crowdNote: p?.crowdNote ?? null,
          tip: p?.localTip ?? null,
          why: it.reason,
        },
      };
    });
    // Untimed bookings (all day, or no time given) lead the day; the rest
    // merge with the stops by clock, a booking before a stop at the same time.
    // Stops keep their own order: a stop with no time stays where it is.
    const untimed = bookingEntries.filter((x) => x.at == null).map((x) => x.entry);
    const timed = bookingEntries.filter((x) => x.at != null).sort((a, b) => a.at! - b.at!);
    const merged: DocEntry[] = [...untimed];
    let k = 0;
    for (const s of stopEntries) {
      while (k < timed.length && s.at != null && timed[k].at! <= s.at) merged.push(timed[k++].entry);
      merged.push(s.entry);
    }
    while (k < timed.length) merged.push(timed[k++].entry);
    return { date, number: i + 1, city: meta.cityName, entries: merged };
  });

  const listed = bookings
    .map((b) => {
      // A booking can have only an end (a check-out, an arrival): keep its date.
      const endOnly = !b.startsAt && b.endsAt ? b.endsAt.slice(0, 10) : null;
      const r = bookingDates(b) ?? (endOnly ? { first: endOnly, last: endOnly } : null);
      return {
        title: b.title, type: b.type, first: r?.first ?? null, last: r?.last ?? null,
        startTime: b.startsAt && b.startTimeKnown !== false ? b.startsAt.slice(11, 16) : null,
        endTime: b.endsAt && b.endTimeKnown !== false ? b.endsAt.slice(11, 16) : null,
      };
    })
    .sort((a, b) => (a.first == null ? 1 : b.first == null ? -1 : a.first.localeCompare(b.first)));

  return {
    route: [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder).map((c) => ({ city: c.name, nights: c.nights })),
    days,
    bookings: listed,
  };
}

/** A booking's dates, with its times where they were given. */
export function bookingWhen(b: PlanDocument["bookings"][number], longDate: (d: string) => string): string {
  const t = copy.print;
  if (!b.first) return t.noDate;
  const from = b.startTime ? t.at(longDate(b.first), b.startTime) : longDate(b.first);
  if (b.first === b.last) {
    if (b.startTime && b.endTime) return t.at(longDate(b.first), t.timeSpan(b.startTime, b.endTime));
    // A date with no start time can still have a known end.
    return !b.startTime && b.endTime ? t.endsAt(longDate(b.first), b.endTime) : from;
  }
  return copy.bookings.range(from, b.endTime ? t.at(longDate(b.last!), b.endTime) : longDate(b.last!));
}
