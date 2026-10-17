import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { loadBookings, loadGaps, type VaultBooking } from "@/lib/vault/store";
import { canEncrypt } from "@/lib/vault/crypto";
import { vaultTotal, type VaultTotal } from "@/lib/vault/money";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { BookingForm } from "./booking-form";
import { Tour } from "@/components/tour/tour";
import { tourSeen } from "@/components/tour/seen";
import { CoverageRibbon, DismissedGaps, GapCard } from "./gap-cards";
import { deleteBooking } from "./actions";
import { copy } from "@/copy";
import { AnalyticsUser, TrackOnce } from "@/components/analytics/analytics";

const t = copy.vault;

// Shown in this order.
const GROUPS: VaultBooking["type"][] = ["flight", "transport", "accommodation", "activity", "restaurant", "other"];

const when = (b: VaultBooking) => {
  // A date given without a time shows as the date alone, never as 00:00.
  const f = (ts: string, timed: boolean) =>
    new Date(ts).toLocaleString(copy.locale, { day: "numeric", month: "short", ...(timed ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "UTC" });
  if (!b.startsAt) return null;
  return b.endsAt ? `${f(b.startsAt, b.startTimeKnown)} → ${f(b.endsAt, b.endTimeKnown)}` : f(b.startsAt, b.startTimeKnown);
};

const money = (b: VaultBooking) =>
  b.costAmount == null ? null : `${b.costCurrency ?? "JPY"} ${b.costAmount.toLocaleString(copy.locale)}`;

/** "~¥48,200 at rates from 10 Oct, plus GBP 120 with no rate on record".
 *  A converted sum is an estimate and says so with the tilde. */
const totalLine = (v: VaultTotal) => {
  const day = (ts: string) => new Date(ts).toLocaleDateString(copy.locale, { day: "numeric", month: "short", timeZone: "UTC" });
  const parts: string[] = [];
  if (v.jpy > 0) {
    parts.push(t.total.jpy(v.jpy.toLocaleString(copy.locale), v.converted) + (v.oldestRateAt ? t.total.ratesFrom(day(v.oldestRateAt)) : ""));
  }
  for (const m of v.missing) parts.push(t.total.noRate(m.currency, m.amount.toLocaleString(copy.locale), parts.length === 0));
  return parts.join(t.total.join);
};

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
  const [bookings, report, cityRows, fxRows] = await Promise.all([
    loadBookings(db, id, reveal),
    loadGaps(db, id, today),
    db.from("trip_cities").select("city_id, sort_order, cities(name)").eq("trip_id", id).order("sort_order"),
    db.from("fx_rates").select("currency, jpy_per_unit, fetched_at"),
  ]);

  const cities = (cityRows.data ?? []).map((c) => ({
    id: c.city_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    name: (c.cities as any)?.name ?? c.city_id,
  }));

  const spent = totalLine(vaultTotal(
    bookings,
    (fxRows.data ?? []).map((r) => ({ currency: r.currency, jpyPerUnit: Number(r.jpy_per_unit), fetchedAt: r.fetched_at })),
  ));
  const error = typeof sp.error === "string" ? sp.error : null;
  const warning = typeof sp.warning === "string" ? sp.warning : null;
  const saved = sp.saved === "1";
  // A ticket gap's "Add a booking" sends the place's id; its name comes
  // from the gap, not the address.
  const place = typeof sp.place === "string" ? sp.place : undefined;
  const placeTitle = place
    ? report.gaps.flatMap((g) => g.actions).find((a) => a.placeId === place)?.title
    : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10">
      <Tour id="vault" seen={await tourSeen("vault")} />
      <AnalyticsUser id={user.id} />
      <AppHeader back={{ href: `/trips/${id}`, label: t.back }}>
        {report.blocking > 0 && (
          <span className="mono pop rounded-full bg-ume px-3 py-1.5 text-[0.78rem] text-white">{t.blocking(report.blocking)}</span>
        )}
      </AppHeader>

      <header className="up mt-7" style={{ animationDelay: ".05s" }}>
        <h1 className="text-[2.2rem] font-extrabold leading-none sm:text-[2.8rem]">{t.title}</h1>
        <p className="mt-2.5 max-w-[62ch] text-[0.98rem] leading-relaxed text-ink-2">
          {t.intro}
        </p>
      </header>

      <div className="mt-5 flex flex-col gap-2">
        <ErrorNote message={error} />
        {warning && <Notice>{warning}</Notice>}
        {saved && <Notice>{t.saved}</Notice>}
        {(saved || warning) && <TrackOnce event="booking_saved" props={{ type: typeof sp.kind === "string" ? sp.kind : null, from_paste: sp.pasted === "1", reference_kept: !warning }} consume={["saved", "warning", "kind", "pasted"]} />}
        {!canEncrypt() && (
          // The server has no BENTO_BOOKING_REF_KEY (openssl rand -base64 32).
          <Notice>{t.noReferences}</Notice>
        )}
      </div>

      <section aria-label={t.coverageLabel} className="mt-5">
        <CoverageRibbon nights={report.nights} covered={report.coveredNights} />
      </section>

      {report.gaps.length > 0 ? (
        <section aria-label={t.gapsLabel} className="mt-3 grid gap-3 sm:grid-cols-2">
          {report.gaps.map((g) => <GapCard key={g.key} tripId={id} gap={g} />)}
        </section>
      ) : (
        <section className="tile up mt-3 px-5 py-8 text-center">
          <p className="disp text-[1.15rem] font-bold">{t.nothingMissing.title}</p>
          <p className="mx-auto mt-2 max-w-[42ch] text-[0.9rem] text-ink-2">
            {t.nothingMissing.body}
          </p>
        </section>
      )}

      <DismissedGaps tripId={id} gaps={report.dismissed} />

      <section aria-label={t.bookingsLabel} className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[1.5rem] font-bold">{t.everything}</h2>
          <span className="mono text-[0.72rem] text-ink-3">
            {t.recorded(bookings.length)}{spent && ` · ${spent}`}
          </span>
        </div>

        <div id="add-booking" data-tour="add-booking" className="mt-4 scroll-mt-6">
          <BookingForm
            tripId={id}
            cities={cities}
            defaultType={typeof sp.add === "string" ? sp.add : undefined}
            defaultDate={typeof sp.on === "string" ? sp.on : undefined}
            defaultPlaceId={place}
            defaultTitle={placeTitle}
          />
        </div>

        {bookings.length > 0 ? (
          <div className="box up mt-4 grid gap-2.5 p-3 sm:grid-cols-2">
            {GROUPS.filter((g) => bookings.some((b) => b.type === g)).map((g) => (
              <div key={g} className="tile up p-5">
                <span className="mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-3">{t.groups[g]}</span>
                <ul className="mt-3 flex flex-col gap-3">
                  {bookings.filter((b) => b.type === g).map((b) => (
                    <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-rule pb-3 last:border-b-0 last:pb-0">
                      <div className="min-w-0">
                        <span className="disp block text-[1rem] font-bold leading-snug">{b.title}</span>
                        <span className="mono mt-0.5 block text-[0.68rem] text-ink-3">
                          {[b.provider, when(b), money(b)].filter(Boolean).join(" · ") || t.noDates}
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
                          <button className="mono text-[0.62rem] uppercase tracking-[0.08em] text-ink-3 hover:text-ume">{t.remove}</button>
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
            {t.empty}
          </p>
        )}
      </section>
    </main>
  );
}
