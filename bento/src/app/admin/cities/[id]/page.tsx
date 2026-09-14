import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { setCoverageTier, createPlace } from "../../actions";
import { ErrorNote } from "@/app/(auth)/ui";

const TIERS = [
  { id: "stub", label: "Stub", blurb: "Exists. Nothing claimed." },
  { id: "outline", label: "Outline", blurb: "Suggests places, won't claim a complete day." },
  { id: "deep", label: "Deep", blurb: "Planner builds whole days here." },
] as const;

export default async function CityDetail({ params, searchParams }: PageProps<"/admin/cities/[id]">) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;

  const { data: city } = await db
    .from("cities")
    .select("id, name, name_ja, coverage_tier, transit_note, wikidata_id")
    .eq("id", id)
    .maybeSingle();

  if (!city) notFound();

  const { data: places } = await db
    .from("places")
    .select("id, name, name_ja, category, verification_status, last_verified")
    .eq("city_id", id)
    .order("verification_status")
    .order("name");

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <Link href="/admin" className="mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-3">
        ← Curation
      </Link>

      <h1 className="mt-7 text-3xl font-bold tracking-tight">
        {city.name}{" "}
        <span className="text-xl font-medium text-ink-3">{city.name_ja}</span>
      </h1>
      {city.transit_note && (
        <p className="mt-3 max-w-xl border-l-[3px] border-indigo bg-indigo-soft px-4 py-3 text-[0.9rem] text-ink-2">
          {city.transit_note}
        </p>
      )}

      <div className="mt-8">
        <ErrorNote message={error} />
      </div>

      <section>
        <h2 className="mono text-[0.68rem] uppercase tracking-[0.12em] text-ink-3">
          Coverage tier
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TIERS.map((tier) => (
            <form key={tier.id} action={setCoverageTier}>
              <input type="hidden" name="cityId" value={city.id} />
              <input type="hidden" name="tier" value={tier.id} />
              <button
                className={`border px-4 py-2 text-left text-[0.85rem] ${
                  city.coverage_tier === tier.id
                    ? "border-indigo bg-indigo text-surface"
                    : "border-rule bg-surface"
                }`}
              >
                <span className="block font-medium">{tier.label}</span>
                <span className="mt-0.5 block text-[0.75rem] opacity-75">{tier.blurb}</span>
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold">
          Places ({places?.length ?? 0})
        </h2>
        {places && places.length > 0 ? (
          <ul className="flex flex-col">
            {places.map((place) => (
              <li key={place.id}>
                <Link
                  href={`/admin/places/${place.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule py-2.5 hover:bg-surface"
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-[0.95rem] font-medium">{place.name}</span>
                    <span className="mono text-[0.72rem] text-ink-3">{place.category}</span>
                  </span>
                  <span
                    className={`mono rounded-[3px] px-1.5 py-0.5 text-[0.62rem] uppercase tracking-[0.08em] ${
                      place.verification_status === "verified"
                        ? "bg-moss-soft text-moss"
                        : "bg-amber-soft text-amber"
                    }`}
                  >
                    {place.verification_status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border border-dashed border-rule px-5 py-7 text-center text-[0.92rem] text-ink-2">
            Nothing here yet. Everything this city shows a traveller starts below.
          </p>
        )}
      </section>

      <section className="mt-10 border-t-2 border-ink pt-6">
        <h2 className="text-base font-bold">Add a place</h2>
        <p className="mt-1.5 text-[0.9rem] text-ink-2">
          Starts as a draft. Judgement fields stay invisible to travellers
          until someone verifies it.
        </p>
        <form action={createPlace} className="mt-5 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="cityId" value={city.id} />
          {[
            { name: "id", label: "Id", placeholder: "kyt-fushimi-inari", required: true },
            { name: "category", label: "Category", placeholder: "shrine", required: true },
            { name: "name", label: "Name", placeholder: "Fushimi Inari Taisha", required: true },
            { name: "nameJa", label: "Name (JA)", placeholder: "伏見稲荷大社", required: false },
          ].map((field) => (
            <div key={field.name} className="flex flex-col gap-1.5">
              <label
                htmlFor={field.name}
                className="mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-3"
              >
                {field.label}
              </label>
              <input
                id={field.name}
                name={field.name}
                required={field.required}
                placeholder={field.placeholder}
                className="border border-rule bg-surface px-3 py-2 text-[0.92rem]"
              />
            </div>
          ))}
          <button className="self-start bg-indigo px-5 py-2.5 text-sm font-medium text-surface sm:col-span-2">
            Create draft
          </button>
        </form>
      </section>
    </main>
  );
}
