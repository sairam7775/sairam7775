import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { bookingRowOfVault, GAP_CITY_COLUMNS, gapCityOf, gapsFrom, loadBookings, type VaultBooking } from "@/lib/vault/store";
import { canEncrypt } from "@/lib/vault/crypto";
import { vaultTotal, type VaultTotal } from "@/lib/vault/money";
import { ErrorNote, Notice } from "@/app/(auth)/ui";
import { ConfirmButton } from "@/components/form-controls";
import { BookingForm } from "./booking-form";
import { Tour } from "@/components/tour/tour";
import { tourSeen } from "@/components/tour/seen";
import { CoverageRibbon, DismissedGaps, GapCard } from "./gap-cards";
import { deleteBooking } from "./actions";
import { copy } from "@/copy";
import { AnalyticsUser, TrackOnce } from "@/components/analytics/analytics";
import { bentoManTip } from "@/lib/vault/bento-man-tip";
import { BentoManCard } from "./bento-man-card";
import { TrackAccepted } from "./track-accepted";
import { Chat } from "../chat";
import { TripChat } from "../trip-chat";
import { loadChat } from "../load-chat";

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

  const reveal = typeof sp.reveal === "string" ? sp.reveal : undefined;
  const today = new Date().toISOString().slice(0, 10);
  // Every read needs only the trip's id, so they go at once; RLS answers
  // nothing for a trip that isn't theirs. The route and the bookings serve
  // both the page and the gap check. A missing trip is a 404 before any
  // other read's failure counts, as when the trip was read first.
  const cityRead = Promise.resolve(db.from("trip_cities").select(GAP_CITY_COLUMNS).eq("trip_id", id).order("sort_order"));
  const settled = <T,>(p: PromiseLike<T>) => Promise.resolve(p).then((value) => ({ value }), (error: unknown) => ({ error }));
  const [{ data: trip }, bookingsRead, cityRows, dayRows, dismissals, fxRows, chatRead] = await Promise.all([
    db.from("trips").select("id, start_date, end_date").eq("id", id).maybeSingle(),
    settled(loadBookings(db, id, reveal)),
    cityRead,
    db.from("itinerary_days").select("date, itinerary_items(place_id)").eq("trip_id", id),
    db.from("gap_dismissals").select("gap_key").eq("trip_id", id),
    db.from("fx_rates").select("currency, jpy_per_unit, fetched_at"),
    settled(loadChat(db, id, cityRead.then((r) => (r.data ?? []).map((c) => { const g = gapCityOf(c); return { id: g.cityId, name: g.name }; })))),
  ]);
  if (!trip) notFound();
  if ("error" in bookingsRead) throw bookingsRead.error;
  if (cityRows.error) throw cityRows.error;
  const bookings = bookingsRead.value;

  const route = (cityRows.data ?? []).map(gapCityOf);
  const cities = route.map((c) => ({ id: c.cityId, name: c.name }));
  const report = await gapsFrom(db, {
    startDate: trip.start_date,
    endDate: trip.end_date,
    cities: route,
    days: (dayRows.data ?? []).map((d) => ({ date: d.date, placeIds: (d.itinerary_items ?? []).map((i) => i.place_id) })),
    bookings: bookings.map(bookingRowOfVault),
    dismissed: (dismissals.data ?? []).map((d) => d.gap_key),
  }, today);
  if ("error" in chatRead) throw chatRead.error;
  const chat = chatRead.value;
  // A gap's "Ask Bento Man" (or a question on his card) puts its question
  // in the chat box; the key comes in the address, the words from the gap.
  const askKey = typeof sp.ask === "string" ? sp.ask : null;
  const ask = askKey
    ? [...report.gaps, ...report.dismissed].find((g) => g.key === askKey)?.actions.find((a) => a.kind === "ask_bento_man")?.hint
    : undefined;
  const tip = bentoManTip(report, { welcome: sp.welcome === "1" });
  // A first route accepted on the plan page lands here: count the answer
  // once, as the proposal card would have (TrackAccepted drops `accepted`).
  const acceptedId = typeof sp.accepted === "string" ? sp.accepted : null;
  const accepted = acceptedId ? chat.messages.find((m) => m.id === acceptedId && m.status === "accepted" && m.proposal) : undefined;

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
    // Room at the bottom on a phone for the floating Ask Bento Man button.
    <main className="mx-auto w-full max-w-[1680px] px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pb-6">
      <Tour id="vault" seen={await tourSeen("vault")} />
      <AnalyticsUser id={user.id} />
      <AppHeader back={{ href: `/trips/${id}`, label: t.back }}>
        {report.blocking > 0 && (
          <span className="mono pop rounded-full bg-ume px-3 py-1.5 text-[0.78rem] text-on-ume">{t.blocking(report.blocking)}</span>
        )}
      </AppHeader>

      <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,34%)] lg:items-start">
        <div className="min-w-0">
          <BentoManCard tripId={id} tip={tip} />

          <header className="settle mt-7" style={{ animationDelay: ".05s" }}>
            <h1 className="text-[2.2rem] font-extrabold leading-none sm:text-[2.8rem]">{t.title}</h1>
            <p className="mt-2.5 max-w-[62ch] text-[0.98rem] leading-relaxed text-ink-2">
              {t.intro}
            </p>
          </header>

          <div className="mt-5 flex flex-col gap-2">
            <ErrorNote message={error} />
            {warning && <Notice>{warning}</Notice>}
            {saved && <Notice>{t.saved}</Notice>}
            {accepted?.proposal && (
          <TrackAccepted answer={{ answer: "accepted", proposal_id: accepted.id, route: Boolean(accepted.proposal.route), dates: Boolean(accepted.proposal.dates), days: accepted.proposal.days.length, verdict: accepted.proposal.route?.verdict ?? null }} />
        )}
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
            <div id="add-booking" data-tour="add-booking" className="scroll-mt-6">
              <BookingForm
                heading={
                  <>
                    <h2 className="text-[1.5rem] font-bold">{t.everything}</h2>
                    <p className="mono mt-1 text-[0.76rem] text-ink-2">
                      {t.recorded(bookings.length)}{spent && ` · ${spent}`}
                    </p>
                  </>
                }
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
                        <li key={b.id} id={b.id} className="scroll-mt-24 border-b border-rule pb-3 last:border-b-0 last:pb-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="disp min-w-0 pt-1.5 text-[1rem] font-bold leading-snug">{b.title}</span>
                            {/* Apart from the reference, and it asks: a slip here loses a booking. */}
                            <form action={deleteBooking} className="-mr-2 shrink-0">
                              <input type="hidden" name="tripId" value={id} />
                              <input type="hidden" name="id" value={b.id} />
                              <ConfirmButton message={t.removeConfirm(b.title)} pending={copy.common.saving} className="min-h-9 rounded-full px-3 text-[0.8rem] text-ink-2 hover:bg-ume-soft hover:text-ume">
                                {t.remove}
                              </ConfirmButton>
                            </form>
                          </div>
                          <p className="mono mt-0.5 text-[0.74rem] leading-relaxed text-ink-2">
                            {[b.provider, when(b), money(b)].filter(Boolean).join(" · ") || t.noDates}
                          </p>
                          {b.notes && <p className="mt-1 text-[0.84rem] text-ink-2">{b.notes}</p>}
                          {(b.reference || b.referenceMasked) && (
                            <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.8rem] text-ink-2">
                              <span>{t.referenceLabel}</span>
                              {b.reference ? (
                                <span className="mono rounded-full bg-lacquer px-2.5 py-1 text-[0.76rem] text-rice">{b.reference}</span>
                              ) : (
                                <Link href={`/trips/${id}/vault?reveal=${b.id}#${b.id}`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-sunk px-3 hover:bg-rule">
                                  <span className="mono text-[0.76rem]">{b.referenceMasked}</span>
                                  <span className="font-medium underline underline-offset-2">{t.referenceShow}</span>
                                </Link>
                              )}
                            </p>
                          )}
                          {b.referenceError && <p className="mt-1 text-[0.8rem] text-ume">{b.referenceError}</p>}
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
        </div>

        <TripChat>
          <Chat tripId={id} cityNames={chat.cityNames} cityTiers={chat.cityTiers} initial={chat.messages} ask={ask} />
        </TripChat>
      </div>
    </main>
  );
}
