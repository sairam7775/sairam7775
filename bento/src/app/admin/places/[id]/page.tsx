import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { savePlace, verifyPlace } from "../../actions";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { INTEREST_TAGS } from "@/lib/types";

function Text({
  name,
  label,
  value,
  hint,
  placeholder,
}: {
  name: string;
  label: string;
  value?: string | null;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-3">
        {label}
      </label>
      <input
        id={name}
        name={name}
        defaultValue={value ?? ""}
        placeholder={placeholder}
        className="border border-rule bg-surface px-3 py-2 text-[0.92rem]"
      />
      {hint && <p className="text-[0.76rem] text-ink-3">{hint}</p>}
    </div>
  );
}

function Area({
  name,
  label,
  value,
  hint,
}: {
  name: string;
  label: string;
  value?: string | null;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <label htmlFor={name} className="mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-3">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={3}
        defaultValue={value ?? ""}
        className="border border-rule bg-surface px-3 py-2 text-[0.92rem] leading-relaxed"
      />
      {hint && <p className="text-[0.76rem] text-ink-3">{hint}</p>}
    </div>
  );
}

export default async function PlaceEditor({ params, searchParams }: PageProps<"/admin/places/[id]">) {
  const { db } = await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;

  const { data: place } = await db.from("places").select("*").eq("id", id).maybeSingle();
  if (!place) notFound();

  const verified = place.verification_status === "verified";

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-14">
      <Link
        href={`/admin/cities/${place.city_id}`}
        className="mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-3"
      >
        ← {place.city_id}
      </Link>

      <div className="mt-7 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{place.name}</h1>
        <span
          className={`mono rounded-[3px] px-2 py-1 text-[0.65rem] uppercase tracking-[0.08em] ${
            verified ? "bg-moss-soft text-moss" : "bg-amber-soft text-amber"
          }`}
        >
          {place.verification_status}
        </span>
      </div>
      <p className="mono mt-1.5 text-[0.75rem] text-ink-3">{place.id}</p>

      <div className="mt-7">
        <ErrorNote message={typeof sp.error === "string" ? sp.error : null} />
        {sp.saved === "1" && (
          <Notice>Saved as a draft. Verify it when the judgement fields are right.</Notice>
        )}
        {sp.verified === "1" && (
          <Notice>
            Verified. The judgement fields below are now visible to travellers.
          </Notice>
        )}
      </div>

      {verified ? (
        <p className="border-l-[3px] border-moss bg-moss-soft px-4 py-3 text-[0.9rem] text-ink-2">
          Signed off by <strong>{place.verified_by}</strong> on{" "}
          <span className="mono">{place.last_verified}</span>. Saving an edit
          returns this record to draft — changing a claim withdraws the
          signature until someone puts it back.
        </p>
      ) : (
        <p className="border-l-[3px] border-amber bg-amber-soft px-4 py-3 text-[0.9rem] text-ink-2">
          Draft. Everything under <strong>Judgement</strong> reads as empty to
          travellers until this is verified — the factual fields above it are
          safe to show as soon as they are imported.
        </p>
      )}

      <form action={savePlace} className="mt-9 flex flex-col gap-10">
        <input type="hidden" name="id" value={place.id} />

        <section>
          <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold">Facts</h2>
          <p className="mt-1.5 text-[0.87rem] text-ink-2">
            Checkable against a source. Shown regardless of verification state.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Text name="name" label="Name" value={place.name} />
            <Text name="nameJa" label="Name (JA)" value={place.name_ja} />
            <Text name="category" label="Category" value={place.category} hint="Drives the redundancy term — the fourth shrine of a day scores lower." />
            <Text name="costJpy" label="Cost (¥)" value={place.cost_jpy?.toString()} />
            <Text name="bookingLeadDays" label="Booking lead (days)" value={place.booking_lead_days?.toString()} hint="How far ahead tickets must be bought." />
            <Text name="sources" label="Sources" value={place.sources?.join(", ")} hint="Comma separated. Required to verify — licence compliance depends on it." />
          </div>
        </section>

        <section>
          <h2 className="border-b-2 border-ink pb-1.5 text-base font-bold">Scoring</h2>
          <p className="mt-1.5 text-[0.87rem] text-ink-2">
            What the recommender reads. Axes run 0 to 1.
          </p>

          <fieldset className="mt-5">
            <legend className="mono text-[0.64rem] uppercase tracking-[0.1em] text-ink-3">
              Interest tags
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
              {INTEREST_TAGS.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 text-[0.88rem]">
                  <input
                    type="checkbox"
                    name="interestTags"
                    value={tag.id}
                    defaultChecked={place.interest_tags?.includes(tag.id)}
                  />
                  {tag.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Text name="energy" label="Energy" value={place.energy?.toString()} hint="0 sit and look · 1 all-day effort. Separates a garden from a mountain trail." />
            <Text name="crowdLevel" label="Crowd level" value={place.crowd_level?.toString()} />
            <Text name="discovery" label="Discovery" value={place.discovery?.toString()} hint="0 famous · 1 most visitors miss it." />
            <Text name="signature" label="Signature" value={place.signature?.toString()} hint="How much a first-timer would regret missing it." />
            <Text name="physicalDemand" label="Physical demand" value={place.physical_demand?.toString()} />
            <Text name="conflictsWith" label="Conflicts with" value={place.conflicts_with?.join(", ")} hint="Place ids that can't share a day — opposite ends of a city." />
            <Text name="pairsWith" label="Pairs with" value={place.pairs_with?.join(", ")} />
          </div>
        </section>

        <section>
          <h2 className="border-b-2 border-vermilion pb-1.5 text-base font-bold">
            Judgement
          </h2>
          <p className="mt-1.5 text-[0.87rem] text-ink-2">
            Claims about the world that no source states outright. These are
            hidden from travellers while this record is a draft — which is the
            whole point of the gate.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Text name="durationTaste" label="Duration — taste (min)" value={place.duration_taste_min?.toString()} hint="Seen it, moving on." />
            <Text name="durationTypical" label="Duration — typical (min)" value={place.duration_typical_min?.toString()} hint="What most people actually spend. Required to verify." />
            <Text name="durationFull" label="Duration — full (min)" value={place.duration_full_min?.toString()} hint="Doing all of it." />
            <Text name="bestWindow" label="Best window" value={place.best_window?.join(", ")} hint='Comma separated, e.g. "before 08:00, after 17:30".' />
            <Area name="crowdNote" label="Crowd note" value={place.crowd_note} hint="When it's unbearable, and when it isn't." />
            <Area name="localTip" label="Local tip" value={place.local_tip} hint="The thing a friend would tell you that no guidebook does." />
            <Text name="worthItIf" label="Worth it if" value={place.worth_it_if?.join(", ")} />
            <Text name="skipIf" label="Skip if" value={place.skip_if?.join(", ")} hint="Never claim step-free access here unless it has been checked in person." />
          </div>
        </section>

        <button className="self-start bg-indigo px-5 py-2.5 text-sm font-medium text-surface">
          Save as draft
        </button>
      </form>

      <section className="mt-12 border-t-2 border-ink pt-6">
        <h2 className="text-base font-bold">Verify</h2>
        <p className="mt-1.5 max-w-xl text-[0.9rem] leading-relaxed text-ink-2">
          Signing this off publishes every judgement field above to
          travellers, under your name and today&apos;s date. Only do it for
          things you have checked — at ~2,000 records, this signature is the
          only thing standing between a drafted guess and someone&apos;s
          holiday.
        </p>
        <form action={verifyPlace} className="mt-5">
          <input type="hidden" name="id" value={place.id} />
          <button className="bg-moss px-5 py-2.5 text-sm font-medium text-surface">
            {verified ? "Re-verify (stamp today)" : "Verify this record"}
          </button>
        </form>
      </section>
    </main>
  );
}
