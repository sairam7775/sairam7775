import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-origin";
import { Tour } from "@/components/tour/tour";
import { tourSeen } from "@/components/tour/seen";
import { AppHeader } from "@/components/app-header";
import { ConfirmButton, DateRangeInputs, SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { nightsBetween } from "@/lib/bento-man/store";
import { buildTripView, dayCoverage, startLiftedLine, travelMoveLine, tripMoves, tripTravelDays } from "@/lib/bento-man/trip-view";
import { fillPercent } from "@/lib/engine/day-stats";
import { journeyMapUrl } from "@/lib/maps/links";
import { travelDayParts } from "@/lib/trips/travel-days";
import type { RouteLegAssessment } from "@/lib/engine/route";
import { bookingRowOf, gapSourceOf, gapsFrom } from "@/lib/vault/store";
import { loadBackgrounds, withBackgrounds } from "@/lib/places/backgrounds";
import { savedStopWarnings } from "@/lib/trips/stop-warnings";
import { ErrorNote } from "@/app/(auth)/ui";
import { updateTrip } from "../actions";
import { renewShareLink, setDatePermission, shareTrip, stopSharing } from "./actions";
import { ShareLink } from "./share-link";
import { ShareExpiryField } from "./share-expiry-field";
import { shareIsActive } from "@/lib/trips/share-expiry";
import { TripActions } from "./trip-actions";
import { DayStrip } from "./day-strip";
import { TripChat } from "./trip-chat";
import { UseSeason } from "@/components/seasonal/background";
import { seasonOf } from "@/components/seasonal/season";
import { Chat } from "./chat";
import { readTrip } from "./load-trip";
import { DayBox } from "./day-box";
import type { PlanBooking } from "./bookings-column";
import { copy } from "@/copy";
import { AnalyticsUser, TrackOnce } from "@/components/analytics/analytics";
import { datesBetween, reviewFromRow, reviewOpen, snapshotCities, snapshotFromRow } from "@/lib/trips/review";
import { TripReviewCard } from "./trip-review";

const t = copy.trip;

const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { ...opts, timeZone: "UTC" });
const dur = copy.time.duration;

/** The trip. Every date is a box; the selected one is open. Bento Man sits
 *  beside it. The boxes show accepted state only — proposals live in the
 *  conversation until the traveller says yes (§08). */
export default async function TripPage({ params, searchParams }: PageProps<"/trips/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/sign-in");

  const store = new SupabaseStore(db, id, user.id);
  const requested = typeof sp.day === "string" ? sp.day : null;
  const today = new Date().toISOString().slice(0, 10);

  // Everything that needs only the trip's id is read at once (`readTrip`); a
  // trip that can't be read is a 404, whatever the other reads did.
  const read = await readTrip(db, store, id);
  if (!read) notFound();
  const { state, chat, bookingRows, reviewRow, share, dismissals } = read;
  const { messages, cityNames, cityTiers } = chat;

  // The selected day doesn't depend on the moves (only its measure does),
  // so its stops are known now.
  const firstView = buildTripView(state, requested);
  const selectedItems = firstView.dayItems ?? [];
  // Then what needs the trip: each travel day's move as the planner allowed
  // it (a failure leaves every day measured as a whole day), each travel
  // day's trains (a failure only leaves them off the page), the day's checked
  // backgrounds (0027; none shown if they can't be read), and the gaps (a
  // failure leaves the bookings bar off), and what's off about each of the
  // day's stops (none said if it can't be worked out). The two travel reads
  // share the store's city and graph reads.
  const [moves, travel, backgrounds, gaps, stopWarnings] = await Promise.all([
    tripMoves(store, state).catch(() => null),
    tripTravelDays(store, state).catch(() => null),
    loadBackgrounds(db, selectedItems.map((i) => i.placeId)),
    gapsFrom(db, gapSourceOf(state, (bookingRows ?? []).map(bookingRowOf), (dismissals ?? []).map((d) => d.gap_key)), today).catch(() => null),
    savedStopWarnings(store, state, firstView.selected).catch(() => null),
  ]);

  const { dayList, statsByDate, selected, selectedDay, dayItems, selectedMeta, stats } = buildTripView(state, requested, moves);
  const move = selected ? moves?.get(selected) ?? null : null;
  const fromName = move ? state.cities.find((c) => c.cityId === move.fromCityId)?.name ?? move.fromCityId : "";
  // An edit lifted the day's start to the arrival; the address says only that.
  const lifted = sp.note === "start-lifted" ? startLiftedLine(move, selectedDay?.items ?? [], fromName) : null;
  // How well Bento knows the selected day's own city, for its heading and box.
  const cover = selectedMeta ? dayCoverage(selectedMeta, selectedDay?.items.length ?? 0) : null;
  // The day's trains in the day's order: the ride there above the stops, a
  // ride on out of the day's city (Himeji, then Hiroshima) below them.
  const trains = selected && travel?.get(selected) ? travelDayParts(travel.get(selected)!, selectedMeta?.cityId ?? "") : null;
  const cityName = (cityId: string) => state.cities.find((c) => c.cityId === cityId)?.name ?? cityId;

  const nights = nightsBetween(state.trip.startDate, state.trip.endDate);
  const error = typeof sp.error === "string" ? sp.error : null;
  // An answer already given stays on the page, and changeable, whatever the
  // trip does after: it is about the plan saved with it.
  const review = reviewFromRow(reviewRow);
  const reviewing = Boolean(review) || reviewOpen(state.trip, state.cities.length > 0, today);
  // An answered trip's hard days are chosen from the plan saved with the
  // first answer, even if the trip has moved since; a new answer, from today's.
  const reviewedPlan = review ? snapshotFromRow(reviewRow?.plan) : null;
  const dayWord = (date: string) => fmt(date, { weekday: "short", day: "numeric", month: "short" });
  const reviewedCities = reviewedPlan ? snapshotCities(reviewedPlan) : null;
  const reviewDays = reviewedPlan
    ? datesBetween(reviewedPlan.start, reviewedPlan.end).map((date, i) => {
        const city = reviewedCities?.get(date);
        return { date, label: city ? copy.review.hardDay(i + 1, dayWord(date), city) : copy.review.hardDayNoCity(i + 1, dayWord(date)) };
      })
    : dayList.map(([date, meta], i) => ({ date, label: copy.review.hardDay(i + 1, dayWord(date), meta.cityName) }));
  const bookings: PlanBooking[] = (bookingRows ?? []).map((b) => ({
    id: b.id, type: b.type, title: b.title, startsAt: b.starts_at, endsAt: b.ends_at, plannedOn: b.planned_on,
    startTimeKnown: b.starts_time_known !== false, endTimeKnown: b.ends_time_known !== false,
  }));
  const shareUrl = share ? `${siteOrigin(await headers())}/shared/${share.token}` : null;
  const shareActive = shareIsActive(share, state.trip.endDate, new Date());
  const shareDay = (at: string) => new Intl.DateTimeFormat(copy.locale, { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(at));
  const shareExpiryLabel = share?.until_trip_end && state.trip.endDate
    ? copy.share.worksUntilTripEnd(shareDay(`${state.trip.endDate}T00:00:00Z`))
    : share?.expires_at
      ? copy.share.worksUntil(shareDay(share.expires_at))
      : copy.share.worksUntilOff;
  // Changing or ending a link is quiet and asks first: whoever has it loses it.
  const quiet = "min-h-9 rounded-full px-3.5 text-[0.84rem] font-medium text-ink-2";
  const sharePanel = (
    <div className="tile flex flex-col gap-3 p-5">
      {share ? (
        <>
          {shareActive && shareUrl
            ? <ShareLink url={shareUrl} title={state.trip.title ?? copy.trips.untitled} />
            : <p className="text-[0.92rem] leading-relaxed text-ink-2">{copy.share.expired}</p>}
          {shareActive && <p className="text-[0.86rem] leading-relaxed text-ink-2">{shareExpiryLabel}</p>}
          <p className="text-[0.86rem] leading-relaxed text-ink-2">{copy.share.who}</p>
          <div className="flex flex-col gap-3 border-t border-rule pt-3">
            <form action={renewShareLink} className="flex w-full flex-wrap items-end gap-3">
              <input type="hidden" name="tripId" value={id} />
              <ShareExpiryField endDate={state.trip.endDate} />
              <ConfirmButton message={copy.share.renewConfirm} pending={copy.common.saving} className={`${quiet} hover:bg-sunk`}>{copy.share.renew}</ConfirmButton>
            </form>
            <form action={stopSharing}>
              <input type="hidden" name="tripId" value={id} />
              <ConfirmButton message={copy.share.stopConfirm} pending={copy.common.saving} className={`${quiet} hover:bg-ume-soft hover:text-ume`}>{copy.share.stop}</ConfirmButton>
            </form>
          </div>
        </>
      ) : (
        <>
          <p className="text-[0.92rem] leading-relaxed text-ink-2">{copy.share.intro}</p>
          <p className="text-[0.86rem] leading-relaxed text-ink-2">{copy.share.who}</p>
          <form action={shareTrip} className="flex flex-col items-start gap-3">
            <input type="hidden" name="tripId" value={id} />
            <ShareExpiryField endDate={state.trip.endDate} />
            <SubmitButton pending={copy.common.saving} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-deep">
              {copy.share.turnOn}
            </SubmitButton>
          </form>
        </>
      )}
    </div>
  );
  const worst = gaps?.gaps[0] ?? null;
  // A gap card's "Ask Bento Man" sends the gap's key, never text: the
  // question is looked up here, so nothing a traveller reads ends up in an
  // address (or in analytics, which records addresses).
  const askKey = typeof sp.ask === "string" ? sp.ask : null;
  const ask = askKey
    ? [...(gaps?.gaps ?? []), ...(gaps?.dismissed ?? [])].find((g) => g.key === askKey)?.actions.find((a) => a.kind === "ask_bento_man")?.hint
    : undefined;

  // Room at the bottom on a phone, so the floating Ask Bento Man button
  // never covers the end of the plan.
  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 pt-6 pb-24 sm:px-6 lg:px-10 lg:pb-6">
      {state.trip.startDate && <UseSeason season={seasonOf(state.trip.startDate)} />}
      <Tour id="trip" seen={await tourSeen("trip")} />
      <AnalyticsUser id={user.id} />
      <AppHeader back={{ href: "/trips", label: copy.common.yourTrips }}>
        {state.trip.startDate && state.trip.endDate && (
          <span className="mono hidden rounded-full bg-lacquer px-3 py-1.5 text-[0.78rem] text-rice sm:inline">
            {t.dateRange(fmt(state.trip.startDate, { day: "numeric", month: "short" }), fmt(state.trip.endDate, { day: "numeric", month: "short" }), nights ?? 0)}
          </span>
        )}
      </AppHeader>

      <div className="mt-6 grid lg:items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,34%)]">
        <section aria-label={t.planLabel} className="min-w-0">
          <header className="settle" style={{ animationDelay: ".05s" }}>
            <h1 className="text-[2.4rem] font-extrabold leading-none sm:text-[3rem]">{state.trip.title ?? copy.trips.untitled}</h1>
            {/* On a phone the dates leave the header, which has no room for them. */}
            {state.trip.startDate && state.trip.endDate && (
              <p className="mono mt-2 text-[0.8rem] text-ink-3 sm:hidden">
                {t.dateRange(fmt(state.trip.startDate, { day: "numeric", month: "short" }), fmt(state.trip.endDate, { day: "numeric", month: "short" }), nights ?? 0)}
              </p>
            )}
            <p className="mt-2.5 max-w-[60ch] text-[0.98rem] leading-relaxed text-ink-2">
              {state.cities.length
                ? t.route(state.cities.map((c) => (c.nights ? t.cityNights(c.name, c.nights) : t.cityDayTrip(c.name))).join(t.routeJoin))
                : t.noRoute}
              {state.trip.partySize > 1 && ` ${t.travelling(state.trip.partySize)}`}
              {state.prefs.set && ` ${t.pace[state.prefs.pace]}`}
            </p>
            <TripActions
              editLabel={state.trip.startDate && state.trip.endDate ? t.edit.open : t.edit.addDates}
              initial={!state.trip.startDate || !state.trip.endDate ? "edit" : sp.share === "1" ? "share" : null}
              downloadHref={state.cities.length > 0 ? `/trips/${id}/print` : null}
              shared={shareActive}
              edit={
                <>
                  <form
                    key={`${state.trip.title ?? ""}|${state.trip.startDate ?? ""}|${state.trip.endDate ?? ""}|${state.trip.partySize}`}
                    action={updateTrip}
                    className="tile flex flex-col gap-4 p-5">
                    <input type="hidden" name="id" value={id} />
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="title" className={fieldLabel}>{t.edit.name}</label>
                      <input id="title" name="title" defaultValue={state.trip.title ?? ""} placeholder={copy.trips.new.namePlaceholder} className={fieldInput} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <DateRangeInputs startLabel={copy.trips.new.arrive} endLabel={copy.trips.new.leave} defaultStart={state.trip.startDate} defaultEnd={state.trip.endDate} labelClass={fieldLabel} inputClass={fieldInput} />
                      <div className="flex flex-col gap-1.5 sm:col-start-3 sm:row-start-1">
                        <label htmlFor="partySize" className={fieldLabel}>{copy.trips.new.people}</label>
                        <input id="partySize" name="partySize" type="number" min={1} max={20} defaultValue={state.trip.partySize} className={fieldInput} />
                      </div>
                    </div>
                    {state.cities.length > 0 && (
                      <p className="text-[0.84rem] text-ink-3">{t.edit.moveNote}</p>
                    )}
                    <SubmitButton pending={copy.common.saving} className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-on-accent hover:bg-accent-deep">{t.edit.save}</SubmitButton>
                  </form>
                  <form action={setDatePermission} className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[0.86rem] text-ink-2">
                    <input type="hidden" name="tripId" value={id} />
                    <input type="hidden" name="allow" value={state.prefs.autoApplyDates ? "off" : "on"} />
                    <span>
                      {state.prefs.autoApplyDates ? t.edit.datesAuto : t.edit.datesAsk}
                    </span>
                    <SubmitButton pending={copy.common.saving} className="min-h-9 rounded-full border border-rule bg-surface px-4 text-[0.84rem] font-medium hover:bg-sunk">
                      {state.prefs.autoApplyDates ? t.edit.askFirst : t.edit.dontAsk}
                    </SubmitButton>
                  </form>
                </>
              }
              /* Shown while shared even with no route, so a link can always be switched off. */
              share={state.cities.length > 0 || shareUrl ? sharePanel : null}
            />
          </header>

          <div className="mt-4"><ErrorNote message={error} /></div>

          {reviewing && (
            <TripReviewCard
              tripId={id}
              review={review}
              days={reviewDays}
            />
          )}
          {typeof sp.reviewed === "string" && (
            <TrackOnce event="trip_reviewed" props={{ challenges: Number(sp.rc) || 0, hard_days: Number(sp.rd) || 0, has_note: sp.rn === "1" }} consume={["reviewed", "rc", "rd", "rn"]} />
          )}

          {gaps && (
            <Link
              href={`/trips/${id}/vault`}
              data-tour="vault"
              className={`up lift mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-tile px-4 py-3 shadow-tile ${gaps.blocking ? "bg-ume-soft" : "bg-surface"}`}
              style={{ animationDelay: ".08s" }}
            >
              <span className={`mono text-[0.62rem] uppercase tracking-[0.1em] ${gaps.blocking ? "text-ume" : "text-ink-3"}`}>
                {gaps.blocking ? t.bookingsBar.blocking(gaps.blocking) : t.bookingsBar.label}
              </span>
              <span className="order-last min-w-0 basis-full text-[0.9rem] leading-snug sm:order-none sm:basis-auto sm:flex-1">
                {worst ? worst.title : gaps.totalNights > 0 ? t.bookingsBar.allBeds(gaps.coveredNights, gaps.totalNights) : t.bookingsBar.noDates}
              </span>
              {gaps.totalNights > 0 && (
                <span aria-hidden className="flex shrink-0 gap-[3px]">
                  {gaps.nights.map((n) => (
                    <span key={n.date} className={`h-4 w-1.5 rounded-full ${n.covered ? "bg-edamame" : "bg-ume"}`} />
                  ))}
                </span>
              )}
              <span className="ml-auto text-[0.85rem] font-medium text-accent-ink sm:ml-0">{t.bookingsBar.open}</span>
            </Link>
          )}

          {dayList.length > 0 && (
            <DayStrip label={t.daysLabel} selected={selected}>
              <ol className="flex w-max gap-2 pb-1">
                {dayList.map(([date, meta], i) => {
                  const s = statsByDate.get(date) ?? null;
                  const pct = s ? fillPercent(s.activeMin, s.budgetMin) : 0;
                  const active = date === selected;
                  return (
                    <li key={date}>
                      <Link
                        href={`/trips/${id}?day=${date}`}
                        aria-current={active ? "page" : undefined}
                        className={`lift flex w-[7.2rem] flex-col gap-1.5 rounded-tile px-3 py-2.5 shadow-tile ${active ? "bg-lacquer text-rice" : "bg-surface text-ink"}`}
                      >
                        <span className="mono text-[0.62rem] uppercase tracking-[0.1em] opacity-70">{t.dayTab(i + 1, fmt(date, { weekday: "short" }))}</span>
                        <span className="disp text-[0.95rem] font-bold leading-tight">
                          {travel?.has(date) && <><span aria-hidden>→ </span><span className="sr-only">{t.travelDay.label}: </span></>}
                          {meta.cityName}
                        </span>
                        <span className={`mono text-[0.62rem] ${active ? "text-rice/70" : "text-ink-3"}`}>{fmt(date, { day: "numeric", month: "short" })}</span>
                        <span className={`mt-0.5 h-1.5 w-full overflow-hidden rounded-full ${active ? "bg-rice/20" : "bg-rule"}`} aria-hidden>
                          <span className={`grow block h-full rounded-full ${s && s.overBy > 0 ? "bg-ume" : "bg-accent"}`} style={{ width: `${pct}%` }} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </DayStrip>
          )}

          {selected && selectedMeta ? (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h2 className="text-[1.5rem] font-bold">
                  {fmt(selected, { weekday: "long", day: "numeric", month: "long" })}
                  {/* One piece, so a narrow screen moves it down whole rather than splitting it. */}
                  <span className="mono ml-3 inline-block text-[0.72rem] font-normal text-ink-3">{selectedMeta.cityName} · {cover!.words}</span>
                </h2>
                {stats && selectedDay && selectedDay.items.length > 0 && (
                  <span className="mono text-[0.72rem] text-ink-3">{t.dayStats(selectedDay.items.length, dur(stats.activeMin))}</span>
                )}
              </div>
              {trains && trains.there.length > 0 && (
                <section aria-label={t.travelDay.label} className="tile up mb-3 px-5 py-4">
                  <p className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{t.travelDay.label}</p>
                  {move && (
                    <p className="mt-2 text-[0.86rem] leading-snug text-ink-2">
                      {travelMoveLine(move, fromName)}
                    </p>
                  )}
                  {lifted && <p role="status" className="mt-1 text-[0.86rem] font-medium leading-snug text-ink">{lifted}</p>}
                  <TrainList legs={trains!.there} />
                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link href={`/trips/${id}/vault`} className="text-[0.86rem] font-medium text-accent-ink hover:underline">{t.travelDay.tickets}</Link>
                    {trains.there.some((l) => l.fareJpy != null && l.fareKind === "estimate") && (
                      <p className="text-[0.78rem] text-ink-3">{t.travelDay.estimate}</p>
                    )}
                  </div>
                </section>
              )}
              <DayBox
                key={selected}
                tripId={id}
                date={selected}
                cityId={selectedMeta.cityId ?? ""}
                cityName={selectedMeta.cityName}
                tier={cover!.words}
                items={withBackgrounds(dayItems ?? [], backgrounds).map((it) => ({ ...it, problems: stopWarnings?.get(it.placeId) ?? [] }))}
                budgetMin={stats?.budgetMin ?? 480}
                fillPct={stats ? fillPercent(stats.activeMin, stats.budgetMin) : 0}
                activeMin={stats?.activeMin ?? 0}
                overBy={stats?.overBy ?? 0}
                overFromIndex={stats?.overFromIndex ?? null}
                lunch={stats?.lunch ?? null}
                freeTime={stats?.freeTime ?? []}
                editable={cover!.editable}
                uncovered={cover!.uncovered}
                mainSights={cover!.mainSights}
                bookings={bookings}
                tripDays={dayList.map(([d]) => d)}
              />
              {trains && trains.onward.length > 0 && (
                <section aria-label={t.travelDay.onward(cityName(trains.onward[0].toCityId))} className="tile up mt-3 px-5 py-4">
                  <p className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{t.travelDay.onward(cityName(trains.onward[0].toCityId))}</p>
                  <TrainList legs={trains.onward} />
                  {trains.onward.some((l) => l.fareJpy != null && l.fareKind === "estimate") && (
                    <p className="mt-3 text-[0.78rem] text-ink-3">{t.travelDay.estimate}</p>
                  )}
                </section>
              )}
            </div>
          ) : (
            <div className="box up mt-4 p-3">
              <div className="tile px-6 py-10 text-center">
                <p className="disp text-[1.2rem] font-bold">{t.emptyBox.title}</p>
                <p className="mx-auto mt-2 max-w-[38ch] text-[0.92rem] text-ink-2">
                  {t.emptyBox.body}
                </p>
              </div>
            </div>
          )}
        </section>

        <TripChat>
          <Chat tripId={id} cityNames={cityNames} cityTiers={cityTiers} initial={messages} ask={ask} />
        </TripChat>
      </div>
    </main>
  );
}

type TrainLeg = Pick<RouteLegAssessment, "fromCityId" | "toCityId" | "summary" | "lines" | "fromStation" | "toStation">;

/** A travel day's trains: each leg's summary, its lines and a directions link. */
function TrainList({ legs }: { legs: TrainLeg[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-3">
      {legs.map((l) => (
        <li key={`${l.fromCityId}-${l.toCityId}`}>
          <p className="text-[0.95rem] font-medium leading-snug">{l.summary}</p>
          {l.lines.map((line) => <p key={line} className="mono mt-1 text-[0.76rem] leading-snug text-ink-2">{line}</p>)}
          {l.fromStation && l.toStation && (
            <a
              href={journeyMapUrl({ from: l.fromStation, to: l.toStation })}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t.travelDay.openDirections(l.fromStation.name, l.toStation.name)}
              className="mt-0.5 inline-flex min-h-6 items-center text-[0.82rem] font-medium text-accent-ink hover:underline"
            >
              {t.travelDay.directions}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
