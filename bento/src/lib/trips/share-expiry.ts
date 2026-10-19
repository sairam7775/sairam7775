/** Expiry choices for a companions' link. The action stores only a timestamp
 *  derived from this choice and trusted trip dates, never a client timestamp. */
export const SHARE_EXPIRY_OPTIONS = ["never", "7-days", "30-days", "trip-end"] as const;
export type ShareExpiryOption = (typeof SHARE_EXPIRY_OPTIONS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Choices that can be honoured from the trip's stored dates. */
export function shareExpiryOptions(endDate: string | null): ShareExpiryOption[] {
  return endDate ? [...SHARE_EXPIRY_OPTIONS] : SHARE_EXPIRY_OPTIONS.filter((option) => option !== "trip-end");
}

/** The expiry instant for a validated option. Trip dates are UTC calendar
 *  dates, so a trip-end link lasts through the inclusive end date. */
export function shareExpiresAt(option: ShareExpiryOption, endDate: string | null, now: Date): string | null {
  switch (option) {
    case "never":
      return null;
    case "7-days":
      return new Date(now.getTime() + 7 * DAY_MS).toISOString();
    case "30-days":
      return new Date(now.getTime() + 30 * DAY_MS).toISOString();
    case "trip-end": {
      if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) throw new RangeError("A trip end date is required");
      const end = new Date(`${endDate}T00:00:00.000Z`);
      if (Number.isNaN(end.getTime()) || end.toISOString().slice(0, 10) !== endDate) throw new RangeError("A valid trip end date is required");
      return new Date(end.getTime() + DAY_MS).toISOString();
    }
  }
}

/** Whether a companions' link still opens, by the same rule as
 *  `shared_trip()`: no expiry, or an expiry still ahead. */
export function shareIsActive(share: { expires_at: string | null } | null, now: Date): boolean {
  if (!share) return false;
  return share.expires_at === null || Date.parse(share.expires_at) > now.getTime();
}
