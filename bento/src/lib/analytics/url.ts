/** Addresses lose everything after the path before an event leaves: query
 *  strings can carry text (?ask= is a question for Bento Man, ?title= a
 *  booking name, ?error= a message). Pages that read such a parameter also
 *  drop it from the address bar (dropParams), which covers replays. */
export function pathOnly(value: string): string {
  return /^https?:\/\//.test(value) ? value.split(/[?#]/)[0] : value;
}
