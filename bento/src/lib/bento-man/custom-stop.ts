/** A stop the traveller named that isn't one of Bento's places (0036) has
 *  no place id. In the app its key on the day is this prefix and its name
 *  simplified, so one name is one stop a day; in the database it is
 *  place_id null and custom_name. No place id starts with the prefix.
 *  Pure, with no imports, so any module (client ones too) can use it. */
export const CUSTOM_STOP_PREFIX = "custom:";

/** The day key of a free-text stop, or null for a name with no letter or
 *  digit in it. */
export function customStopKey(name: string): string | null {
  const slug = name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  return slug ? `${CUSTOM_STOP_PREFIX}${slug}` : null;
}

export const isCustomStop = (placeId: string): boolean => placeId.startsWith(CUSTOM_STOP_PREFIX);
