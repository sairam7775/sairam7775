import { requireAdmin } from "@/lib/admin";
import { AppHeader } from "@/components/app-header";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { askWindowStart } from "@/lib/places/background-draft";
import { approveBackground, saveBackground } from "../background-actions";

/** How many asked-about places without a background the page lists. */
const ASKED = 30;

interface BackgroundRow {
  place_id: string;
  body: string;
  sources: string[];
  status: "draft" | "verified";
  drafted_by: string;
  verified_by: string | null;
  verified_on: string | null;
}
interface PlaceRow { id: string; name: string; city_id: string; sources: string[] | null }

function BackgroundForm({ placeId, body, sources }: { placeId: string; body: string; sources: string }) {
  return (
    <form action={saveBackground} className="mt-3 flex flex-col gap-2.5">
      <input type="hidden" name="placeId" value={placeId} />
      <textarea
        name="body"
        defaultValue={body}
        rows={5}
        aria-label={`Background of ${placeId}`}
        className="border border-rule bg-surface px-3 py-2 text-[0.92rem] leading-relaxed"
      />
      <label className="flex flex-col gap-1 text-[0.8rem] text-ink-2">
        Sources, comma-separated (the official pages it comes from)
        <input name="sources" defaultValue={sources} className="border border-rule bg-surface px-3 py-2 text-[0.92rem] text-ink" />
      </label>
      <button className="self-start bg-accent px-5 py-2 text-sm font-medium text-surface">Save as draft</button>
    </form>
  );
}

/** Bento's own knowledge of each place (0027): the lasting story travellers
 *  ask Bento Man about. The most-asked places come first; a draft (from
 *  scripts/draft-backgrounds.ts or written here) reaches travellers only
 *  once it is approved here and the place itself is verified. */
export default async function PlaceBackgrounds({ searchParams }: PageProps<"/admin/backgrounds">) {
  const { db } = await requireAdmin();
  const sp = await searchParams;

  const since = askWindowStart(new Date());
  const [{ data: askRows }, { data: bgRows }] = await Promise.all([
    db.from("place_background_asks").select("place_id, asks").gte("day", since),
    db.from("place_backgrounds").select("place_id, body, sources, status, drafted_by, verified_by, verified_on").order("place_id"),
  ]);
  const asks = new Map<string, number>();
  for (const a of askRows ?? []) asks.set(a.place_id, (asks.get(a.place_id) ?? 0) + a.asks);
  const rows = (bgRows ?? []) as BackgroundRow[];
  const written = new Set(rows.map((r) => r.place_id));
  const byAsks = (a: string, b: string) => (asks.get(b) ?? 0) - (asks.get(a) ?? 0) || a.localeCompare(b);

  const asked = [...asks.keys()].filter((id) => !written.has(id)).sort(byAsks).slice(0, ASKED);
  const drafts = rows.filter((r) => r.status === "draft").sort((a, b) => byAsks(a.place_id, b.place_id));
  const checked = rows.filter((r) => r.status === "verified");

  const ids = [...new Set([...asked, ...rows.map((r) => r.place_id)])];
  const { data: placeRows } = ids.length ? await db.from("places").select("id, name, city_id, sources").in("id", ids) : { data: [] };
  const places = new Map(((placeRows ?? []) as PlaceRow[]).map((p) => [p.id, p]));
  const title = (id: string) => places.get(id)?.name ?? id;
  const askedTimes = (id: string) => (asks.get(id) ? ` · asked ${asks.get(id)} time${asks.get(id) === 1 ? "" : "s"}` : "");
  const message = (key: string) => (typeof sp[key] === "string" ? (sp[key] as string) : null);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/admin", label: "Curation" }}>
        <span className="mono rounded-full bg-sunk px-3 py-1 text-[0.68rem] uppercase tracking-[0.1em] text-ink-2">Admin</span>
      </AppHeader>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Place backgrounds</h1>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
        The lasting story of each place, which Bento Man retells instead of relying on the AI model. History and what
        it is known for only: no opening times, no prices. Travellers see a background once you approve it and the
        place is verified.
      </p>

      <div className="mt-6">
        <ErrorNote message={message("error")} />
        {message("saved") && <Notice>Saved {title(message("saved")!)} as a draft. Approve it when it reads right.</Notice>}
        {message("approved") && <Notice>Approved {title(message("approved")!)}. Bento Man retells it from now on.</Notice>}
      </div>

      <section className="mt-9">
        <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold">Asked about, not written yet</h2>
        {asked.length === 0 ? (
          <p className="mt-3 text-[0.9rem] text-ink-2">Nothing waiting. Places appear here when travellers ask Bento Man about their history.</p>
        ) : (
          asked.map((id) => (
            <article key={id} className="border-b border-rule py-5">
              <h3 className="font-bold">{title(id)}</h3>
              <p className="mono mt-0.5 text-[0.72rem] text-ink-3">{id}{askedTimes(id)}</p>
              <BackgroundForm placeId={id} body="" sources={(places.get(id)?.sources ?? []).join(", ")} />
            </article>
          ))
        )}
      </section>

      <section className="mt-10">
        <h2 className="border-b-2 border-tamago pb-1.5 text-base font-bold">Drafts to check ({drafts.length})</h2>
        {drafts.length === 0 && <p className="mt-3 text-[0.9rem] text-ink-2">No drafts. Run scripts/draft-backgrounds.ts or write one above.</p>}
        {drafts.map((r) => (
          <article key={r.place_id} className="border-b border-rule py-5">
            <h3 className="font-bold">{title(r.place_id)}</h3>
            <p className="mono mt-0.5 text-[0.72rem] text-ink-3">{r.place_id} · drafted by {r.drafted_by}{askedTimes(r.place_id)}</p>
            <BackgroundForm placeId={r.place_id} body={r.body} sources={r.sources.join(", ")} />
            <form action={approveBackground} className="mt-2.5 flex flex-wrap items-center gap-3">
              <input type="hidden" name="placeId" value={r.place_id} />
              <button className="bg-edamame px-5 py-2 text-sm font-medium text-surface">Approve as saved</button>
              <span className="text-[0.8rem] text-ink-3">Save your edits first: Approve signs the text as it was last saved.</span>
            </form>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <details>
          <summary className="cursor-pointer border-b-2 border-edamame pb-1.5 text-base font-bold">Checked ({checked.length})</summary>
          <p className="mt-3 text-[0.85rem] text-ink-2">Saving an edit here sends the background back to draft until it is approved again.</p>
          {checked.map((r) => (
            <article key={r.place_id} className="border-b border-rule py-5">
              <h3 className="font-bold">{title(r.place_id)}</h3>
              <p className="mono mt-0.5 text-[0.72rem] text-ink-3">{r.place_id} · approved by {r.verified_by} on {r.verified_on}{askedTimes(r.place_id)}</p>
              <BackgroundForm placeId={r.place_id} body={r.body} sources={r.sources.join(", ")} />
            </article>
          ))}
        </details>
      </section>
    </main>
  );
}
