/** Expiry choices for a companions' link. The action stores only what it
 *  derives from this choice and trusted trip dates, never a client timestamp. */
export const SHARE_EXPIRY_OPTIONS = ["never", "7-days", "30-days", "trip-end"] as const;
export type ShareExpiryOption = (typeof SHARE_EXPIRY_OPTIONS)[number];

/** A `trip_shares` row's expiry (0024): a fixed instant, or "until the trip
 *  ends", which follows the trip's end date when the dates change. */
export interface ShareExpiry {
  expires_at: string | null;
  until_trip_end: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Choices that can be honoured from the trip's stored dates. */
export function shareExpiryOptions(endDate: string | null): ShareExpiryOption[] {
  return endDate ? [...SHARE_EXPIRY_OPTIONS] : SHARE_EXPIRY_OPTIONS.filter((option) => option !== "trip-end");
}

/** The first instant after the trip: trip dates are UTC calendar dates, so a
 *  link until the trip ends works through the whole last day. */
function afterTrip(endDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return null;
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== endDate) return null;
  return end.getTime() + DAY_MS;
}

/** What to store for a validated option. "Until the trip ends" needs a
 *  valid end date now, but stores the choice, not a time. */
export function shareExpiry(option: ShareExpiryOption, endDate: string | null, now: Date): ShareExpiry {
  switch (option) {
    case "never":
      return { expires_at: null, until_trip_end: false };
    case "7-days":
      return { expires_at: new Date(now.getTime() + 7 * DAY_MS).toISOString(), until_trip_end: false };
    case "30-days":
      return { expires_at: new Date(now.getTime() + 30 * DAY_MS).toISOString(), until_trip_end: false };
    case "trip-end":
      if (!endDate || afterTrip(endDate) === null) throw new RangeError("A valid trip end date is required");
      return { expires_at: null, until_trip_end: true };
  }
}

/** Whether a companions' link still opens, by the same rule as
 *  `shared_trip()`: any fixed expiry still ahead, and, for a link until the
 *  trip ends, the trip's current last day not yet over. */
export function shareIsActive(share: ShareExpiry | null, endDate: string | null, now: Date): boolean {
  if (!share) return false;
  if (share.expires_at !== null && Date.parse(share.expires_at) <= now.getTime()) return false;
  if (!share.until_trip_end) return true;
  const after = endDate ? afterTrip(endDate) : null;
  return after !== null && now.getTime() < after;
}
