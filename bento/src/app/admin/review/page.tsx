import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { costBandWords } from "@/lib/engine/cost-band";
import { AppHeader } from "@/components/app-header";
import { verifyPlace } from "../actions";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { INTEREST_TAGS } from "@/lib/types";
import { REVIEW_NOTE_COLUMNS, type ReviewNote } from "@/lib/places/review-notes";
import { ReviewNotes } from "../review-notes";

/** This page's address with the given filters. */
function reviewHref({ city, notes, skip }: { city: string | null; notes: boolean; skip?: string[] }) {
  const query = new URLSearchParams();
  if (city) query.set("city", city);
  if (notes) query.set("notes", "1");
  if (skip?.length) query.set("skip", skip.join(","));
  return `/admin/review${query.size ? `?${query}` : ""}`;
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{k}</span>
      <span className="text-[0.92rem] leading-relaxed">{v ?? <span className="text-ink-3">—</span>}</span>
    </div>
  );
}

/** The review queue: one draft at a time, every field visible, one click to
 *  sign it off or move on. At ~160 records a page-per-record editor is
 *  the difference between a weekend and a month. With `?notes=1` it shows
 *  only places the AI reviewers disagree on, verified or not, with the
 *  points to settle on the card. */
export default async function Review({ searchParams }: PageProps<"/admin/review">) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const city = typeof sp.city === "string" ? sp.city : null;
  const skip = typeof sp.skip === "string" ? sp.skip.split(",").filter(Boolean) : [];
  const notesOnly = sp.notes === "1";

  const { data: openNotes } = await db.from("place_review_notes").select("place_id").is("settled_at", null);
  const disputed = [...new Set((openNotes ?? []).map((n) => n.place_id as string))];

  let query = db
    .from("places")
    .select("*, cities!inner(name)")
    .order("city_id")
    .order("signature", { ascending: false })
    .limit(50);
  query = notesOnly ? query.in("id", disputed) : query.eq("verification_status", "draft");
  if (city) query = query.eq("city_id", city);
  const { data: drafts } = notesOnly && !disputed.length ? { data: [] } : await query;

  const { count: remaining } = await db.from("places").select("id", { count: "exact", head: true }).eq("verification_status", "draft");
  const next = (drafts ?? []).find((d) => !skip.includes(d.id)) ?? null;
  const { data: notes } = next
    ? await db.from("place_review_notes").select(REVIEW_NOTE_COLUMNS).eq("place_id", next.id).order("settled_at", { nullsFirst: true }).order("field")
    : { data: [] };

  const label = (tag: string) => INTEREST_TAGS.find((t) => t.id === tag)?.label ?? tag;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/admin", label: "Curation" }}>
        <span className="mono text-[0.72rem] text-ink-3">
          {notesOnly ? `${disputed.length} with disagreements` : `${remaining ?? 0} drafts left`}{city ? ` · ${city}` : ""}
        </span>
        <span className="mono rounded-full bg-sunk px-3 py-1 text-[0.68rem] uppercase tracking-[0.1em] text-ink-2">Admin</span>
      </AppHeader>

      <h1 className="mt-8 text-3xl font-bold tracking-tight">Review queue</h1>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
        Read it as a traveller would. If the durations, the window and the tip are what you&rsquo;d tell a
        friend, sign it. If not, open the editor. Anything you skip comes round again.
      </p>
      <Link href={`/admin/review/bulk${city ? `?city=${encodeURIComponent(city)}` : ""}`} className="mt-3 inline-flex min-h-10 items-center border border-rule bg-surface px-4 text-sm font-medium hover:bg-sunk">
        Verify several at once →
      </Link>
      {(notesOnly || disputed.length > 0) && (
        <Link
          href={reviewHref({ city, notes: !notesOnly })}
          className="ml-3 mt-3 inline-flex min-h-10 items-center border border-rule bg-surface px-4 text-sm font-medium hover:bg-sunk"
        >
          {notesOnly ? "Show every draft" : `Only where the reviewers disagree (${disputed.length})`}
        </Link>
      )}

      <div className="mt-6">
        <ErrorNote message={typeof sp.error === "string" ? sp.error : null} />
        {sp.verified === "1" && <Notice>Verified. Next one below.</Notice>}
        {sp.settled === "1" && <Notice>Settled.</Notice>}
      </div>

      {!next ? (
        <p className="mt-8 border border-dashed border-rule px-5 py-8 text-center text-[0.95rem] text-ink-2">
          {notesOnly ? "No disagreements left to settle" : "Nothing left to review"}{city ? ` in ${city}` : ""}.
        </p>
      ) : (
        <article className="mt-6 border border-rule bg-surface">
          <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-6 py-4">
            <div>
              <h2 className="text-xl font-bold">{next.name} <span className="ml-2 text-base font-medium text-ink-3">{next.name_ja}</span></h2>
              <p className="mono mt-1 text-[0.72rem] text-ink-3">{next.id} · {next.cities?.name} · {next.category}</p>
            </div>
            <Link href={`/admin/places/${next.id}`} className="mono text-[0.7rem] uppercase tracking-[0.08em] text-accent-ink underline underline-offset-2">Open editor</Link>
          </header>

          <section className="grid gap-x-8 gap-y-5 px-6 py-5 sm:grid-cols-2">
            <Field k="Durations" v={`${next.duration_taste_min ?? "—"} · ${next.duration_typical_min ?? "—"} · ${next.duration_full_min ?? "—"} min`} />
            <Field k="Best window" v={next.best_window?.join(" · ")} />
            <Field k="Crowd note" v={next.crowd_note} />
            <Field k="Local tip" v={next.local_tip} />
            <Field k="Worth it if" v={next.worth_it_if?.join(", ")} />
            <Field k="Skip if" v={next.skip_if?.join(", ")} />
          </section>

          <section className="grid gap-x-8 gap-y-5 border-t border-rule bg-sunk/40 px-6 py-5 sm:grid-cols-3">
            <Field k="Tags" v={next.interest_tags?.map(label).join(", ")} />
            <Field k="Energy · crowd · discovery" v={`${next.energy} · ${next.crowd_level} · ${next.discovery}`} />
            <Field k="Signature" v={next.signature} />
            <Field k="Cost" v={next.cost_jpy != null ? `¥${next.cost_jpy.toLocaleString("en")} · travellers see ${costBandWords(next.cost_jpy)}` : null} />
            <Field k="Hours" v={next.opens_at || next.closes_at ? `${String(next.opens_at ?? "").slice(0, 5)}–${String(next.closes_at ?? "").slice(0, 5)}${next.hours_vary ? " · varies by season (shortest hours)" : ""}` : "always open"} />
            <Field k="Closed" v={next.closed_weekdays?.length ? next.closed_weekdays.map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ") : null} />
            <Field k="Booking" v={`${next.booking_req}${next.booking_lead_days ? ` · ${next.booking_lead_days} days ahead` : ""}`} />
            <Field k="Station" v={next.nearest_station ? `${next.nearest_station} · ${next.station_walk_min} min walk` : "no station — bus or walk"} />
            <Field k="Conflicts with" v={next.conflicts_with?.join(", ")} />
            <Field k="Sources" v={next.sources?.join(", ")} />
            <Field k="Seasons" v={next.seasons?.join(", ")} />
          </section>

          <ReviewNotes notes={(notes ?? []) as ReviewNote[]} back={reviewHref({ city, notes: notesOnly, skip })} />

          <footer className="flex flex-wrap items-center gap-3 border-t border-rule px-6 py-4">
            <form action={verifyPlace}>
              <input type="hidden" name="id" value={next.id} />
              <input type="hidden" name="back" value={reviewHref({ city, notes: notesOnly })} />
              <button className="bg-edamame px-5 py-2.5 text-sm font-medium text-surface">Verify — this is what I&rsquo;d tell a friend</button>
            </form>
            <Link
              href={reviewHref({ city, notes: notesOnly, skip: [...skip, next.id] })}
              className="border border-rule bg-surface px-5 py-2.5 text-sm font-medium"
            >
              Skip for now
            </Link>
            <span className="mono ml-auto text-[0.7rem] text-ink-3">{(drafts?.length ?? 0) - skip.length} in this batch</span>
          </footer>
        </article>
      )}
    </main>
  );
}
