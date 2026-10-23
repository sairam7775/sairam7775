/** A place's checked background: the lasting story (history, what it is
 *  known for) that Bento Man retells and the trip page shows. Hours and
 *  prices change, so they stay on the place record and never belong here.
 *  The same rule guards the drafter and the admin form (0027 checks the
 *  length again in the database). */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlaceBackground {
  placeId: string;
  body: string;
  sources: string[];
}

// Checked after NFKC, so full-width digits, colons and ￥ read as their
// plain forms. A bare 円 is a word (円山公園), so only an amount is a price.
const CLOCK = [
  /\b\d{1,2}:\d{2}\b/,
  /\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)(?![a-z])/i,
  /\b\d{1,2}\.\d{2}\s*(?:to|until|till|-|–|—)\s*\d{1,2}\.\d{2}\b/i,
  /\d{1,2}\s*時/,
];
const PRICE = /¥\s*\d|\d[\d,]*\s*(?:円|yen\b)|\b(?:JPY|yen)\b/i;

/** Why this text can't be a background, or null when it can. The reasons
 *  are for the admin who wrote or checked it. */
export function checkBackgroundText(body: string): string | null {
  const text = body.normalize("NFKC").trim();
  if (text.length < 120) return "A background needs at least 120 characters.";
  if (text.length > 900) return "A background is at most 900 characters.";
  if (CLOCK.some((r) => r.test(text))) return "A background can't contain a clock time; opening hours stay on the place.";
  if (PRICE.test(text)) return "A background can't contain a price; prices stay on the place.";
  return null;
}

/** Checked backgrounds for these places, by place id. Reads the public view
 *  (checked backgrounds of verified places). A failed read is logged and
 *  shows nothing, so a page or a chat turn never fails over it. */
export async function loadBackgrounds(db: SupabaseClient, placeIds: string[]): Promise<Map<string, PlaceBackground>> {
  const out = new Map<string, PlaceBackground>();
  if (!placeIds.length) return out;
  const { data, error } = await db.from("place_backgrounds_public").select("place_id, body, sources").in("place_id", [...new Set(placeIds)]);
  if (error) {
    console.error("place backgrounds unreadable", error.message);
    return out;
  }
  for (const r of data ?? []) out.set(r.place_id, { placeId: r.place_id, body: r.body, sources: r.sources ?? [] });
  return out;
}

/** A day's stops with their checked backgrounds attached, for the trip page. */
export function withBackgrounds<T extends { placeId: string }>(items: T[], backgrounds: Map<string, PlaceBackground>): (T & { background: string | null })[] {
  return items.map((i) => ({ ...i, background: backgrounds.get(i.placeId)?.body ?? null }));
}
