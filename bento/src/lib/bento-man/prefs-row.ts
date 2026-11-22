import type { Prefs } from "./store";

/** The user_preferences columns the trip state reads: exactly what
 *  prefsFromRow uses (a test keeps the two equal). */
export const PREF_COLUMNS =
  "pace, interest_tags, energy, crowd_tolerance, discovery, excludes, mobility, dietary, display_currency, onboarded, apply_dates_without_asking";

/** A user_preferences row as the trip state reads it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function prefsFromRow(p: any): Prefs {
  return {
    pace: p.pace,
    interestTags: p.interest_tags ?? [],
    energy: Number(p.energy),
    crowdTolerance: Number(p.crowd_tolerance),
    discovery: Number(p.discovery),
    excludes: p.excludes ?? [],
    mobility: p.mobility ?? [],
    dietary: p.dietary ?? [],
    displayCurrency: p.display_currency ?? "JPY",
    set: Boolean(p.onboarded),
    autoApplyDates: Boolean(p.apply_dates_without_asking),
  };
}
