/** Where to send someone after signing in — only ever a path on this site.
 *
 *  An open redirect off the back of a real sign-in is a credible phishing
 *  vector: /sign-in?next=https://evil.example would land a freshly signed-in
 *  traveller on a look-alike page. "Starts with /" is not enough: "//evil"
 *  and "/\evil" are protocol-relative to a browser, so they leave the site. */
export function safeNext(next: unknown, fallback = "/trips"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // Control characters (a tab or newline inside "/\t/evil") are stripped by
  // URL parsers and can turn a path into a host.
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
