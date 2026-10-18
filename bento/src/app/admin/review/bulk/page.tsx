import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { AppHeader } from "@/components/app-header";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { INTEREST_TAGS } from "@/lib/types";
import { MAX_BULK_VERIFY, missingForVerify } from "@/lib/places/verify";
import { BulkList, type BulkDraft } from "./bulk-list";

/** Verify many drafts at once. Faster than the one-at-a-time queue and
 *  just as binding: every ticked record is signed with the admin's name.
 *  The queue (/admin/review) is still the place to read each one. */
export default async function BulkReview({ searchParams }: PageProps<"/admin/review/bulk">) {
  const { db } = await requireAdmin();
  const sp = await searchParams;
  const city = typeof sp.city === "string" ? sp.city : null;

  let query = db
    .from("places")
    .select("id, name, city_id, duration_typical_min, interest_tags, sources, signature, cities!inner(name)")
    .eq("verification_status", "draft")
    .order("city_id")
    .order("signature", { ascending: false })
    .limit(MAX_BULK_VERIFY);
  if (city) query = query.eq("city_id", city);
  const [{ data: rows }, { data: allDrafts }] = await Promise.all([
    query,
    db.from("places").select("city_id, cities!inner(name)").eq("verification_status", "draft"),
  ]);

  const label = (tag: string) => INTEREST_TAGS.find((t) => t.id === tag)?.label ?? tag;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cityName = (r: any) => (Array.isArray(r.cities) ? r.cities[0]?.name : r.cities?.name) ?? r.city_id;
  const drafts: BulkDraft[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    cityName: cityName(r),
    duration: r.duration_typical_min,
    tags: (r.interest_tags ?? []).map(label).join(", "),
    missing: missingForVerify(r),
  }));

  // One chip per city that still has drafts, with its count.
  const counts = new Map<string, { name: string; n: number }>();
  for (const r of allDrafts ?? []) {
    const c = counts.get(r.city_id) ?? { name: cityName(r), n: 0 };
    c.n += 1;
    counts.set(r.city_id, c);
  }
  const total = allDrafts?.length ?? 0;
  const back = `/admin/review/bulk${city ? `?city=${encodeURIComponent(city)}` : ""}`;
  const verified = typeof sp.bulkVerified === "string" ? Number(sp.bulkVerified) : null;
  const notReady = typeof sp.notReady === "string" ? sp.notReady.split(",").filter(Boolean) : [];

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-[0.82rem] ${active ? "border-lacquer bg-lacquer text-rice" : "border-rule text-ink-2 hover:bg-sunk"}`;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <AppHeader back={{ href: "/admin/review", label: "Review queue" }}>
        <span className="mono text-[0.72rem] text-ink-3">{total} drafts left</span>
        <span className="mono rounded-full bg-sunk px-3 py-1 text-[0.68rem] uppercase tracking-[0.1em] text-ink-2">Admin</span>
      </AppHeader>

      <h1 className="mt-8 text-3xl font-bold tracking-tight">Verify several at once</h1>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
        Tick the places you&rsquo;re happy with and verify them together. Each is signed with your name and goes
        straight to travellers and Bento Man, exactly as if you&rsquo;d verified it in the{" "}
        <Link href="/admin/review" className="text-accent-ink underline underline-offset-2">queue</Link>. Places missing a duration,
        a tag or a source can&rsquo;t be ticked until they&rsquo;re filled in.
      </p>
      <p className="mt-2 max-w-xl text-[0.88rem] leading-relaxed text-ink-3">
        Verifying places doesn&rsquo;t change a city&rsquo;s coverage. Raise it on the city&rsquo;s page once enough places are verified,
        or Bento Man still won&rsquo;t plan days there.
      </p>

      <div className="mt-6">
        <ErrorNote message={typeof sp.error === "string" ? sp.error : null} />
        {verified != null && (
          <Notice>
            Verified {verified} place{verified === 1 ? "" : "s"}.
            {notReady.length > 0 && ` Not verified, still missing details: ${notReady.join(", ")}.`}
          </Notice>
        )}
      </div>

      <nav aria-label="Cities" className="mt-2 flex flex-wrap gap-2">
        <Link href="/admin/review/bulk" className={chip(!city)}>All ({total})</Link>
        {[...counts].map(([id, c]) => (
          <Link key={id} href={`/admin/review/bulk?city=${encodeURIComponent(id)}`} className={chip(city === id)}>
            {c.name} ({c.n})
          </Link>
        ))}
      </nav>

      {drafts.length ? (
        <BulkList key={back} drafts={drafts} back={back} />
      ) : (
        <p className="mt-8 border border-dashed border-rule px-5 py-8 text-center text-[0.95rem] text-ink-2">
          Nothing left to verify{city ? " in this city" : ""}.
        </p>
      )}
    </main>
  );
}
