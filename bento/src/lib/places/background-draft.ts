/** Drafting place backgrounds from official pages (scripts/draft-backgrounds.ts).
 *  A draft is only a suggestion: an admin checks it in /admin/backgrounds
 *  before any traveller sees it. Gemini reads the pages with url_context
 *  (never Google Maps grounding), and a draft whose pages could not be read
 *  is skipped rather than saved, so nothing is written from memory alone. */
import { checkBackgroundText } from "./backgrounds";

export type Draft = { ok: true; body: string; sources: string[] } | { ok: false; reason: string };

/** Which places to draft: the ones named, or the most-asked (ties by id).
 *  A place with a checked background is never redrafted. */
export function pickPlaces(asks: { place_id: string; asks: number }[], checked: Set<string>, limit: number, named?: string[]): string[] {
  if (named?.length) return named.filter((id) => !checked.has(id)).slice(0, limit);
  const total = new Map<string, number>();
  for (const a of asks) total.set(a.place_id, (total.get(a.place_id) ?? 0) + a.asks);
  return [...total]
    .filter(([id]) => !checked.has(id))
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, limit)
    .map(([id]) => id);
}

export function draftPrompt(p: { name: string; nameJa: string | null; city: string; urls: string[] }): string {
  const name = p.nameJa ? `${p.name} (${p.nameJa})` : p.name;
  return `Write the background of ${name} in ${p.city}, Japan, for a first-time visitor, in two to four plain sentences: when and why it was built or founded, what happened to it that matters, and what it is known for. Use only what these official pages say: ${p.urls.join(", ")}. Write it in your own words; do not copy sentences. No opening hours, prices, crowd advice or anything that changes. Do not use Google Maps.
Reply with ONLY a JSON object, no code fence: {"background": "..."}`;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    urlContextMetadata?: { urlMetadata?: { retrievedUrl?: string; urlRetrievalStatus?: string }[] };
  }[];
}

/** Gemini's generateContent reply → a draft, or why there isn't one. */
export function parseDraft(response: unknown): Draft {
  const cand = (response as GeminiResponse)?.candidates?.[0];
  const read = (cand?.urlContextMetadata?.urlMetadata ?? [])
    .filter((u) => u.urlRetrievalStatus === "URL_RETRIEVAL_STATUS_SUCCESS" && u.retrievedUrl)
    .map((u) => u.retrievedUrl!);
  if (!read.length) return { ok: false, reason: "no official page could be read" };

  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").replace(/^```(?:json)?\s*|\s*```\s*$/g, "").trim();
  let body: unknown;
  try {
    body = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)).background;
  } catch {
    body = undefined;
  }
  if (typeof body !== "string") return { ok: false, reason: "unreadable reply" };

  const refused = checkBackgroundText(body);
  if (refused) return { ok: false, reason: refused };
  return { ok: true, body: body.trim(), sources: [...new Set(read)] };
}
