import { copy } from "@/copy";

/** The walkthrough, one short tour per page. A step with a `target` points
 *  at the element marked `data-tour="<target>"`; with none (or when that
 *  element isn't on the page right now) it is a centred card. The words are
 *  in `copy.tour`; this file only says where each step points. The tour only
 *  points; it never changes anything. */

export type TourId = "trips" | "trip" | "vault";

export interface TourStep {
  target?: string;
  title: string;
  body: string;
}

const t = copy.tour;

export const TOURS: Record<TourId, TourStep[]> = {
  trips: [
    t.trips.welcome,
    { target: "new-trip", ...t.trips.newTrip },
    t.trips.open,
  ],
  trip: [
    { target: "chat", ...t.trip.chat },
    { target: "edit-trip", ...t.trip.edit },
    { target: "day-box", ...t.trip.dayBox },
    { target: "vault", ...t.trip.vault },
    t.trip.end,
  ],
  vault: [
    t.vault.missing,
    { target: "add-booking", ...t.vault.add },
  ],
};

export const TOUR_IDS = Object.keys(TOURS) as TourId[];
