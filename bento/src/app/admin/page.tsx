import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { BentoLogo } from "@/components/logo";

interface Progress {
  city_id: string;
  name: string;
  name_ja: string | null;
  coverage_tier: "deep" | "outline" | "stub";
  prefecture: string;
  region: string;
  total_places: number;
  verified_places: number;
  draft_places: number;
}

const TIER_STYLE: Record<Progress["coverage_tier"], string> = {
  deep: "bg-moss-soft text-moss",
  outline: "bg-amber-soft text-amber",
  stub: "bg-sunk text-ink-3",
};

export default async function AdminHome() {
  const { db } = await requireAdmin();

  const { data } = await db
    .from("curation_progress")
    .select("*")
    .order("region")
    .order("name");

  const rows = (data ?? []) as Progress[];

  const totals = {
    cities: rows.length,
    deep: rows.filter((r) => r.coverage_tier === "deep").length,
    outline: rows.filter((r) => r.coverage_tier === "outline").length,
    verified: rows.reduce((n, r) => n + Number(r.verified_places), 0),
    drafts: rows.reduce((n, r) => n + Number(r.draft_places), 0),
  };

  const byRegion = rows.reduce<Record<string, Progress[]>>((acc, row) => {
    (acc[row.region] ??= []).push(row);
    return acc;
  }, {});

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-14">
      <Link href="/" className="inline-flex" aria-label="Bento home">
        <BentoLogo />
      </Link>
      <h1 className="mt-8 text-3xl font-bold tracking-tight">Curation</h1>
      <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed text-ink-2">
        Every city exists from day one. What changes is how much of it we can
        honestly claim to know — and the tier says so out loud rather than
        letting a thin plan pass for a good one.
      </p>

      {totals.drafts > 0 && (
        <Link href="/admin/review" className="mt-6 inline-block bg-moss px-5 py-2.5 text-sm font-medium text-surface">
          Review {totals.drafts} draft{totals.drafts === 1 ? "" : "s"}
        </Link>
      )}

      <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-3 border-y border-rule py-4">
        {[
          ["Cities", totals.cities],
          ["Deep", totals.deep],
          ["Outline", totals.outline],
          ["Verified places", totals.verified],
          ["Drafts", totals.drafts],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt className="mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-3">
              {label}
            </dt>
            <dd className="mono mt-0.5 text-lg tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {Object.entries(byRegion).map(([region, cities]) => (
        <section key={region} className="mt-10">
          <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold">{region}</h2>
          <ul className="mt-3 flex flex-col">
            {cities.map((city) => (
              <li key={city.city_id}>
                <Link
                  href={`/admin/cities/${city.city_id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-2.5 hover:bg-surface"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-[0.95rem] font-medium">{city.name}</span>
                    <span className="text-[0.8rem] text-ink-3">{city.name_ja}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="mono text-[0.72rem] tabular-nums text-ink-3">
                      {city.verified_places} verified
                      {Number(city.draft_places) > 0 && ` · ${city.draft_places} draft`}
                    </span>
                    <span
                      className={`mono rounded-[3px] px-1.5 py-0.5 text-[0.62rem] uppercase tracking-[0.08em] ${TIER_STYLE[city.coverage_tier]}`}
                    >
                      {city.coverage_tier}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
