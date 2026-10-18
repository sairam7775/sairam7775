/** Addresses lose everything after the path before an event leaves. No
 *  page puts a traveller's text in an address (gap cards send a gap key or
 *  a place id, and the page looks the words up), but ?error= carries a
 *  message and future links might slip; this is the backstop. A shared
 *  plan's address is its key, so that part is replaced, in paths too. */
export function pathOnly(value: string): string {
  const v = value.replace(SHARED, "/shared/link");
  return /^https?:\/\//.test(v) ? v.split(/[?#]/)[0] : v;
}

const SHARED = /\/shared\/[^/?#\s]+/g;

/** A shared plan's page (0020), where analytics never start. */
export const isSharedPath = (path: string | null): boolean => path?.startsWith("/shared/") ?? false;
