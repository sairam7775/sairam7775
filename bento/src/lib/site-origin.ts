/** The address the site is served from, for links read outside the page (a
 *  sign-in email, a saved plan): NEXT_PUBLIC_SITE_URL when set, otherwise
 *  the request's own host. No trailing slash. */
export function siteOrigin(h: Pick<Headers, "get">, configured = process.env.NEXT_PUBLIC_SITE_URL): string {
  return (configured || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`).replace(/\/+$/, "");
}
