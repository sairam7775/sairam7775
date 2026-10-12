/** Does a booking hold the ticket for a planned place?
 *
 *  One answer for both sides: the gap detector (is a required ticket
 *  missing?) and the planner (may a booking-required place go in the day?).
 *  If they disagreed, the vault could say "booked" while the planner still
 *  left the place out, or the other way round.
 *
 *  A booking made from a gap carries the place's id, and that is the match.
 *  One typed by hand is matched by name, conservatively: an activity booking
 *  on that date whose title contains the place's name. "Ghibli Museum
 *  ticket" holds the Ghibli Museum; "Museum ticket" holds nothing, and one
 *  teamLab ticket does not hold a different teamLab. Any ticket on the day
 *  holding every ticketed place — the old rule — hid real gaps. */

export interface TicketLike {
  type: string;
  title: string;
  /** "YYYY-MM-DD" */
  startsOn: string | null;
  placeId: string | null;
}

/** Lower case, accents and punctuation gone, single spaces. */
function simplify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The part of a place name people actually write: "Ghibli Museum (Mitaka)"
 *  → "ghibli museum", "Fushimi Inari Taisha · 伏見稲荷大社" → "fushimi inari taisha". */
function coreName(name: string): string {
  return simplify(name.split(/[(（·,，/]/)[0]);
}

export function bookingHoldsPlace(b: TicketLike, place: { id: string; name: string }, date: string): boolean {
  if (b.placeId) return b.placeId === place.id && (b.startsOn == null || b.startsOn === date);
  if (b.type !== "activity" || b.startsOn !== date) return false;
  const core = coreName(place.name);
  return core.length >= 3 && ` ${simplify(b.title)} `.includes(` ${core} `);
}

/** Every place id among `places` that some booking holds on `date`. */
export function bookedPlaceIds(bookings: TicketLike[], places: { id: string; name: string }[], date: string): string[] {
  return places.filter((p) => bookings.some((b) => bookingHoldsPlace(b, p, date))).map((p) => p.id);
}
