import { copy } from "@/copy";

/** The words and times a proposal card shows. Kept apart from diff.ts's
 *  schemas so the card doesn't bring zod into the browser
 *  (lib/security/client-imports.test.ts). */

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { day: "numeric", month: "short", timeZone: "UTC" });

/** "1 Oct – 10 Oct (9 nights)", or "no dates". */
export function describeDates(t: { startDate: string | null; endDate: string | null }): string {
  if (!t.startDate && !t.endDate) return copy.plan.dates.none;
  const nights = t.startDate && t.endDate ? Math.round((Date.parse(`${t.endDate}T00:00:00Z`) - Date.parse(`${t.startDate}T00:00:00Z`)) / 86_400_000) : null;
  const range = copy.plan.dates.range(t.startDate ? shortDate(t.startDate) : copy.plan.dates.unknown, t.endDate ? shortDate(t.endDate) : copy.plan.dates.unknown);
  return nights == null ? range : copy.plan.dates.rangeNights(range, nights);
}

export const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
