import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BentoLogo } from "@/components/logo";
import { loadBookings, loadGaps, type VaultBooking } from "@/lib/vault/store";
import { canEncrypt } from "@/lib/vault/crypto";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { BookingForm } from "./booking-form";
import { CoverageRibbon, DismissedGaps, GapCard } from "./gap-cards";
import { deleteBooking } from "./actions";

const GROUPS: { id: VaultBooking["type"]; label: string }[] = [
  { id: "flight", label: "Flights" },
  { id: "transport", label: "Between cities" },
  { id: "accommodation", label: "Where you sleep" },
  { id: "activity", label: "Tickets" },
  { id: "restaurant", label: "Tables" },
  { id: "other", label: "Other" },
];

const when = (b: VaultBooking) => {
  const f = (ts: string) => new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  if (!b.startsAt) return null;
  return b.endsAt ? `${f(b.startsAt)} → ${f(b.endsAt)}` : f(b.startsAt);
};

const money = (b: VaultBooking) =>
  b.costAmount == null ? null : `${b.costCurrency ?? "JPY"} ${b.costAmount.toLocaleString("en")}`;

/** The vault: everything the traveller has booked, and what is still
 *  missing. Nothing here is fetched from an airline or a hotel — which is
 *  also why it can hold reference numbers safely (§11). */
export default async function VaultPage({ params, searchParams }: PageProps<"/trips/[id]/vault">) {
  const { id } = await params;
  const sp = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: trip } = await db.from("trips").select("id, title").eq("id", id).maybeSingle();
  if (!trip) notFound();

  const reveal = typeof sp.reveal === "string" ? sp.reveal : undefined;
  const today = new Date().toISOString().slice(0, 10);
  const [bookings, report, cityRows] = await Promise.all([
    loadBookings(db, id, reveal),
    loadGaps(db, id, today),
    db.from("trip_cities").select("city_id, sort_order, cities(name)").eq("trip_id", id).order("sort_order"),
  ]);

  const cities = (cityRows.data ?? []).map((c) => ({
    id: c.city_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (c.cities as any)?.name ?? c.city_id,
  }));

  const spentJpy = bookings.reduce((s, b) => s + (b.costJpy ?? 0), 0);
  const error = typeof sp.error === "string" ? sp.error : null;
  const warning = typeof sp.warning === "string" ? sp.warning : null;
  const saved = sp.saved === "1";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="up flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex" aria-label="Bento home"><BentoLogo /></Link>
        <div className="flex flex-wrap items-center gap-2">
          {report.blocking > 0 && (
            <span className="mono pop rounded-full bg-ume px-3 py-1.5 text-[0.72rem] text-white">{report.blocking} blocking</span>
          )}
          <Link href={`/trips/${id}`} className="mono rounded-full bg-surface px-3 py-1.5 text-[0.72rem] text-ink-2 shadow-[0_1px_2px_rgba(34,28,30,.06)]">← The plan</Link>
        </div>
      </div>

      <header className="up mt-7" style={{ animationDelay: ".05s" }}>
        <h1 className="text-[2.2rem] font-extrabold leading-none sm:text-[2.8rem]">What&rsquo;s still missing</h1>
        <p className="mt-2.5 max-w-[62ch] text-[0.98rem] leading-relaxed text-ink-2">
          Every night needs a bed, every move between cities needs a way to get there, and anything with a timed ticket needs the ticket.
          Nothing is fetched from airlines or hotels. This only knows what you put here, which is also why it can hold your reference numbers safely.
        </p>
      </header>

      <div className="mt-5 flex flex-col gap-2">
        <ErrorNote message={error} />
        {warning && <Notice>{warning}</Notice>}
        {saved && <Notice>Saved.</Notice>}
        {!canEncrypt() && (
          <Notice>
            This server has no <span className="mono text-[0.85em]">BENTO_BOOKING_REF_KEY</span>, so booking references cannot be stored. Everything
            else saves normally. Generate one with <span className="mono text-[0.85em]">openssl rand -base64 32</span>.
          </Notice>
        )}
      </div>

      <section aria-label="Coverage" className="mt-5">
        <CoverageRibbon nights={report.nights} covered={report.coveredNights} />
      </section>

      {report.gaps.length > 0 ? (
        <section aria-label="Gaps" className="mt-3 grid gap-3 sm:grid-cols-2">
          {report.gaps.map((g) => <GapCard key={g.key} tripId={id} gap={g} />)}
        </section>
      ) : (
        <section className="tile up mt-3 px-5 py-8 text-center">
          <p className="disp text-[1.15rem] font-bold">Nothing is missing.</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[0.9rem] text-ink-2">
            Every night has a bed, every move has a way, and nothing on the plan needs a ticket you do not have.
          </p>
        </section>
      )}

      <DismissedGaps tripId={id} gaps={report.dismissed} />

      <section aria-label="Bookings" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[1.5rem] font-bold">Everything you&rsquo;ve booked</h2>
          <span className="mono text-[0.72rem] text-ink-3">
            {bookings.length} recorded{spentJpy > 0 && ` · ¥${spentJpy.toLocaleString("en")} in yen`}
          </span>
        </div>

        <div className="mt-4">
          <BookingForm
            tripId={id}
            cities={cities}
            defaultType={typeof sp.add === "string" ? sp.add : undefined}
            defaultDate={typeof sp.on === "string" ? sp.on : undefined}
          />
        </div>

        {bookings.length > 0 ? (
          <div className="box up mt-4 grid gap-2.5 p-3 sm:grid-cols-2">
            {GROUPS.filter((g) => bookings.some((b) => b.type === g.id)).map((g) => (
              <div key={g.id} className="tile up p-5">
                <span className="mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-3">{g.label}</span>
                <ul className="mt-3 flex flex-col gap-3">
                  {bookings.filter((b) => b.type === g.id).map((b) => (
                    <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-rule pb-3 last:border-b-0 last:pb-0">
                      <div className="min-w-0">
                        <span className="disp block text-[1rem] font-bold leading-snug">{b.title}</span>
                        <span className="mono mt-0.5 block text-[0.68rem] text-ink-3">
                          {[b.provider, when(b), money(b)].filter(Boolean).join(" · ") || "no dates recorded"}
                        </span>
                        {b.notes && <p className="mt-1 text-[0.82rem] text-ink-2">{b.notes}</p>}
                        {b.referenceError && <p className="mt-1 text-[0.78rem] text-ume">{b.referenceError}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {b.reference ? (
                          <span className="mono rounded-full bg-lacquer px-2.5 py-1 text-[0.72rem] text-rice">{b.reference}</span>
                        ) : b.referenceMasked ? (
                          <Link href={`/trips/${id}/vault?reveal=${b.id}#${b.id}`} className="mono rounded-full bg-sunk px-2.5 py-1 text-[0.72rem] text-ink-2">
                            {b.referenceMasked}
                          </Link>
                        ) : null}
                        <form action={deleteBooking}>
                          <input type="hidden" name="tripId" value={id} />
                          <input type="hidden" name="id" value={b.id} />
                          <button className="mono text-[0.62rem] uppercase tracking-[0.08em] text-ink-3 hover:text-ume">Remove</button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="tile up mt-4 px-5 py-8 text-center text-[0.92rem] text-ink-2">
            Nothing recorded yet. Add what you book as you book it, and the ribbon above fills in.
          </p>
        )}
      </section>
    </main>
  );
}
