/** Addresses lose everything after the path before an event leaves. No
 *  page puts a traveller's text in an address (gap cards send a gap key or
 *  a place id, and the page looks the words up), but ?error= carries a
 *  message and future links might slip; this is the backstop. */
export function pathOnly(value: string): string {
  return /^https?:\/\//.test(value) ? value.split(/[?#]/)[0] : value;
}
