/** The traveller's answer to "may Bento record how you use it?". Kept in a
 *  cookie so the server can render the right thing (banner or not) with no
 *  flash. No answer means no analytics: nothing loads until "yes". */
export const ANALYTICS_COOKIE = "bento_analytics";

export type Consent = "yes" | "no";

export function parseConsent(value: string | undefined): Consent | null {
  return value === "yes" || value === "no" ? value : null;
}
