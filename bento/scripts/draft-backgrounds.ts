/**
 * Drafts place backgrounds (0027) from each place's official pages, for an
 * admin to check in /admin/backgrounds. Nothing reaches a traveller from here.
 *
 *   npx tsx scripts/draft-backgrounds.ts                            # the 5 most-asked, dry run
 *   npx tsx scripts/draft-backgrounds.ts --places kyt-kinkakuji,kyt-kiyomizu
 *   npx tsx scripts/draft-backgrounds.ts --limit 3 --write          # save them as drafts
 *   npx tsx scripts/draft-backgrounds.ts --redraft --write          # also replace the model's earlier drafts
 *
 * One Gemini request per place, on the free-tier quota the live site's Bento
 * Man shares (about 20 a day per model), so keep runs small; a 429 stops the
 * run. Gemini reads the official pages with url_context, never Google Maps.
 * A place with no official page on record costs no request. A place whose
 * pages could not be read, or didn't say enough, is skipped. A place that
 * already has a background is left alone: --redraft replaces only drafts
 * the model wrote, never an admin's text or a checked background.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { askWindowStart, draftPrompt, notToDraft, officialUrls, parseDraft, pickPlaces } from "../src/lib/places/background-draft";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const named = flag("--places")?.split(",").map((s) => s.trim()).filter(Boolean);
const limit = Number(flag("--limit") ?? 5);
const model = flag("--model") ?? "gemini-3.8-flash";
const write = args.includes("--write");
const redraft = args.includes("--redraft");
const PAUSE_MS = 13000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!url || !key || !geminiKey) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY.");
    process.exit(1);
  }
  if (!Number.isInteger(limit) || limit < 1) {
    console.error("--limit is a whole number of places, 1 or more.");
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  const [asks, written] = await Promise.all([
    named ? Promise.resolve({ data: [], error: null }) : db.from("place_background_asks").select("place_id, asks").gte("day", askWindowStart(new Date())),
    db.from("place_backgrounds").select("place_id, status, drafted_by"),
  ]);
  if (asks.error) throw asks.error;
  if (written.error) throw written.error;

  // The candidates' official pages first, so the limit counts only places a
  // request can draft.
  const candidates = named ?? [...new Set((asks.data ?? []).map((a) => a.place_id))];
  const { data: places, error } = candidates.length
    ? await db.from("places").select("id, name, name_ja, sources, cities(name)").in("id", candidates)
    : { data: [], error: null };
  if (error) throw error;
  const byId = new Map((places ?? []).map((p) => [p.id, { ...p, urls: officialUrls((p.sources ?? []) as string[]) }]));
  const skip = notToDraft(written.data ?? [], redraft);
  for (const id of candidates) {
    const p = byId.get(id);
    if (p && p.urls.length) continue;
    skip.add(id);
    if (named) console.log(`${id} · skipped: ${p ? "no official page on record" : "not in places"}`);
  }
  const ids = pickPlaces(asks.data ?? [], skip, limit, named);
  if (!ids.length) return console.log("Nothing to draft: no asked-about place with an official page is without a background.");

  console.log(`${write ? "Drafting" : "Dry run for"} ${ids.length} place${ids.length === 1 ? "" : "s"} on ${model}.`);
  for (const [n, id] of ids.entries()) {
    const p = byId.get(id)!;
    const city = (p.cities as unknown as { name: string } | null)?.name ?? "";

    if (n > 0) await sleep(PAUSE_MS);
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: draftPrompt({ name: p.name, nameJa: p.name_ja, city, urls: p.urls }) }] }], tools: [{ url_context: {} }] }),
    });
    if (res.status === 429) {
      console.log(`Out of Gemini quota. Not drafted yet: ${ids.slice(n).join(", ")}`);
      return;
    }
    if (!res.ok) { console.log(`${id} · skipped: Gemini HTTP ${res.status}`); continue; }

    const draft = parseDraft(await res.json());
    if (!draft.ok) { console.log(`${id} · skipped: ${draft.reason}`); continue; }
    console.log(`${id} · drafted\n  ${draft.body}\n  from ${draft.sources.join(", ")}`);
    if (write) {
      // Insert, or (with --redraft) replace the model's own earlier draft.
      // An admin's text, or a row checked meanwhile, is left alone.
      const row = { place_id: id, body: draft.body, sources: draft.sources, status: "draft", drafted_by: model, updated_at: new Date().toISOString() };
      const inserted = await db.from("place_backgrounds").insert(row);
      if (!inserted.error) continue;
      if (inserted.error.code !== "23505") { console.log(`  not saved: ${inserted.error.message}`); continue; }
      const replaced = redraft
        ? await db.from("place_backgrounds").update(row).eq("place_id", id).eq("status", "draft").like("drafted_by", "gemini%").select("place_id")
        : { data: [], error: null };
      if (replaced.error) console.log(`  not saved: ${replaced.error.message}`);
      else if (!replaced.data?.length) console.log("  not saved: it already has a background an admin wrote or checked");
    }
  }
  if (!write) console.log("Dry run: nothing saved. Add --write to save these as drafts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
