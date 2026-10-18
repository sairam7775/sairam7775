/** What Bento calls a traveller, for the greeting on the trips and home
 *  pages. Optional: asked at sign-up and in Settings, kept in the account's
 *  own metadata (`display_name`), and never sent to Bento Man or analytics.
 *
 *  A traveller who signed in with Google and never set one gets the first
 *  name Google sent. Once they save a name in Settings, even an empty one,
 *  that choice wins: clearing it must not bring Google's back. */

export const NAME_MAX = 40;

/** A typed name made safe to keep and show: control characters out, runs of
 *  spaces collapsed, trimmed, at most NAME_MAX characters. "" means none. */
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const flat = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
  return [...flat].slice(0, NAME_MAX).join("").trim();
}

type Metadata = Record<string, unknown> | undefined;

/** The name to greet with, or null for a greeting without one. */
export function displayName(user: { user_metadata?: Metadata } | null | undefined): string | null {
  const meta = user?.user_metadata;
  if (!meta) return null;
  // Metadata can be written by the account itself, so it is cleaned on the
  // way out too, not only when Settings saves it.
  if ("display_name" in meta) return cleanName(meta.display_name) || null;
  const given = cleanName(meta.given_name);
  if (given) return given;
  const full = cleanName(meta.full_name) || cleanName(meta.name);
  return full ? full.split(" ")[0] : null;
}
