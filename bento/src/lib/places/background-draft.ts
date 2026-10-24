/** Drafting place backgrounds from official pages (scripts/draft-backgrounds.ts).
 *  A draft is only a suggestion: an admin checks it in /admin/backgrounds
 *  before any traveller sees it. Gemini reads the pages with url_context
 *  (never Google Maps grounding), and a draft whose pages could not be read
 *  is skipped rather than saved, so nothing is written from memory alone. */
import { checkBackgroundText } from "./backgrounds";

export type Draft = { ok: true; body: string; sources: string[] } | { ok: false; reason: string };

/** Asks from this many days back decide what gets written first. */
export const ASK_DAYS = 90;

/** The first day (ISO date) whose asks still count. */
export function askWindowStart(today: Date): string {
  return new Date(today.getTime() - ASK_DAYS * 86400000).toISOString().slice(0, 10);
}

/** Drafts the script writes carry the model's id in drafted_by; an admin's
 *  carry their email. Only the model's own drafts are ever redrafted. */
export const MODEL_DRAFTED = /^gemini/;

/** The places a run must leave alone: every checked background, and every
 *  draft unless --redraft, which still never touches an admin's own text. */
export function notToDraft(rows: { place_id: string; status: string; drafted_by: string }[], redraft: boolean): Set<string> {
  return new Set(rows.filter((r) => r.status !== "draft" || !redraft || !MODEL_DRAFTED.test(r.drafted_by)).map((r) => r.place_id));
}

/** A place's sources that are official pages to read. Sources also hold
 *  provenance tags ("wikivoyage") and encyclopaedias, which are not. */
export function officialUrls(sources: string[]): string[] {
  return sources
    .map((s) => s.trim())
    .filter((s) => s.includes(".") && !/wiki(voyage|pedia)/i.test(s))
    .map((s) => (/^https?:\/\//.test(s) ? s : `https://${s}/`));
}

/** Which places to draft: the ones named, or the most-asked (ties by id),
 *  never one in `skip` (see notToDraft, and places with no official page). */
export function pickPlaces(asks: { place_id: string; asks: number }[], skip: Set<string>, limit: number, named?: string[]): string[] {
  if (named?.length) return named.filter((id) => !skip.has(id)).slice(0, limit);
  const total = new Map<string, number>();
  for (const a of asks) total.set(a.place_id, (total.get(a.place_id) ?? 0) + a.asks);
  return [...total]
    .filter(([id]) => !skip.has(id))
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, limit)
    .map(([id]) => id);
}

export function draftPrompt(p: { name: string; nameJa: string | null; city: string; urls: string[] }): string {
  const name = p.nameJa ? `${p.name} (${p.nameJa})` : p.name;
  return `Write the background of ${name} in ${p.city}, Japan, for a first-time visitor, in two to four plain sentences: when and why it was built or founded, what happened to it that matters, and what it is known for. Use only what these official pages say: ${p.urls.join(", ")}. Write it in your own words; do not copy sentences. No opening hours, prices, crowd advice or anything that changes. Do not use Google Maps. If these pages do not say enough to write it, do not write it from memory: reply {"background": null}.
Reply with ONLY a JSON object, no code fence: {"background": "..."}`;
}

/** One drafting request: Gemini's reply, a spent quota (which stops the
 *  run), or why this place is skipped. A request that fails or times out
 *  skips only its place; the run goes on to the next. */
export type Reply = { kind: "reply"; json: unknown } | { kind: "quota" } | { kind: "skip"; reason: string };

export async function requestDraft(send: () => Promise<Response>): Promise<Reply> {
  let res: Response;
  try {
    res = await send();
  } catch {
    return { kind: "skip", reason: "Gemini didn't answer" };
  }
  if (res.status === 429) return { kind: "quota" };
  if (!res.ok) return { kind: "skip", reason: `Gemini HTTP ${res.status}` };
  try {
    return { kind: "reply", json: await res.json() };
  } catch {
    return { kind: "skip", reason: "unreadable reply" };
  }
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
  if (body === null) return { ok: false, reason: "the official pages didn't say enough" };
  if (typeof body !== "string") return { ok: false, reason: "unreadable reply" };

  const refused = checkBackgroundText(body);
  if (refused) return { ok: false, reason: refused };
  return { ok: true, body: body.trim(), sources: [...new Set(read)] };
}
