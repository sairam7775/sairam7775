import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { verifyPlace } from "../actions";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { INTEREST_TAGS } from "@/lib/types";

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
 *  the difference between a weekend and a month. */
export default async function Review({ searchParams }: PageProps<"/admin/review">) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const city = typeof sp.city === "string" ? sp.city : null;
  const skip = typeof sp.skip === "string" ? sp.skip.split(",").filter(Boolean) : [];

  let query = db
    .from("places")
    .select("*, cities!inner(name)")
    .eq("verification_status", "draft")
    .order("city_id")
    .order("signature", { ascending: false })
    .limit(50);
  if (city) query = query.eq("city_id", city);
  const { data: drafts } = await query;

  const { count: remaining } = await db.from("places").select("id", { count: "exact", head: true }).eq("verification_status", "draft");
  const next = (drafts ?? []).find((d) => !skip.includes(d.id)) ?? null;

  const label = (tag: string) => INTEREST_TAGS.find((t) => t.id === tag)?.label ?? tag;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link href="/admin" className="mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-3">← Curation</Link>
        <span className="mono text-[0.72rem] text-ink-3">{remaining ?? 0} drafts left{city ? ` · ${city}` : ""}</span>
      </div>

      <h1 className="mt-7 text-3xl font-bold tracking-tight">Review queue</h1>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
        Read it as a traveller would. If the durations, the window and the tip are what you&rsquo;d tell a
        friend, sign it. If not, open the editor. Anything you skip comes round again.
      </p>

      <div className="mt-6">
        <ErrorNote message={typeof sp.error === "string" ? sp.error : null} />
        {sp.verified === "1" && <Notice>Verified. Next one below.</Notice>}
      </div>

      {!next ? (
        <p className="mt-8 border border-dashed border-rule px-5 py-8 text-center text-[0.95rem] text-ink-2">
          Nothing left to review{city ? ` in ${city}` : ""}.
        </p>
      ) : (
        <article className="mt-6 border border-rule bg-surface">
          <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-6 py-4">
            <div>
              <h2 className="text-xl font-bold">{next.name} <span className="ml-2 text-base font-medium text-ink-3">{next.name_ja}</span></h2>
              <p className="mono mt-1 text-[0.72rem] text-ink-3">{next.id} · {next.cities?.name} · {next.category}</p>
            </div>
            <Link href={`/admin/places/${next.id}`} className="mono text-[0.7rem] uppercase tracking-[0.08em] text-accent underline underline-offset-2">Open editor</Link>
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
            <Field k="Cost" v={next.cost_jpy != null ? `¥${next.cost_jpy.toLocaleString("en")}` : null} />
            <Field k="Hours" v={next.opens_at || next.closes_at ? `${String(next.opens_at ?? "").slice(0, 5)}–${String(next.closes_at ?? "").slice(0, 5)}` : "always open"} />
            <Field k="Closed" v={next.closed_weekdays?.length ? next.closed_weekdays.map((d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ") : null} />
            <Field k="Booking" v={`${next.booking_req}${next.booking_lead_days ? ` · ${next.booking_lead_days} days ahead` : ""}`} />
            <Field k="Station" v={next.nearest_station ? `${next.nearest_station} · ${next.station_walk_min} min walk` : "no station — bus or walk"} />
            <Field k="Conflicts with" v={next.conflicts_with?.join(", ")} />
            <Field k="Sources" v={next.sources?.join(", ")} />
            <Field k="Seasons" v={next.seasons?.join(", ")} />
          </section>

          <footer className="flex flex-wrap items-center gap-3 border-t border-rule px-6 py-4">
            <form action={verifyPlace}>
              <input type="hidden" name="id" value={next.id} />
              <input type="hidden" name="back" value={`/admin/review${city ? `?city=${city}` : ""}`} />
              <button className="bg-edamame px-5 py-2.5 text-sm font-medium text-surface">Verify — this is what I&rsquo;d tell a friend</button>
            </form>
            <Link
              href={`/admin/review?${new URLSearchParams({ ...(city ? { city } : {}), skip: [...skip, next.id].join(",") })}`}
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
