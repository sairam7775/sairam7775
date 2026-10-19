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
import { parseProposal } from "@/lib/bento-man/diff";
import { nightsBetween, type TripState } from "@/lib/bento-man/store";
import { buildTripView } from "@/lib/bento-man/trip-view";
import { loadGaps } from "@/lib/vault/store";
import { ErrorNote } from "@/app/(auth)/ui";
import { updateTrip } from "../actions";
import { renewShareLink, setDatePermission, shareTrip, stopSharing } from "./actions";
import { ShareLink } from "./share-link";
import { TripActions } from "./trip-actions";
import { UseSeason } from "@/components/seasonal/background";
import { seasonOf } from "@/components/seasonal/season";
import { Chat, type ChatMessage } from "./chat";
import { DayBox } from "./day-box";
import type { PlanBooking } from "./bookings-column";
import { copy } from "@/copy";
import { AnalyticsUser, TrackOnce } from "@/components/analytics/analytics";
import { datesBetween, reviewFromRow, reviewOpen, snapshotCities, snapshotFromRow } from "@/lib/trips/review";
import { TripReviewCard } from "./trip-review";
import type { CoverageTier } from "@/lib/types";
import { assessRoute } from "@/lib/engine/route";
import { travelDays } from "@/lib/trips/travel-days";

const t = copy.trip;

const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { ...opts, timeZone: "UTC" });
const dur = copy.time.duration;
/** A coverage tier in words; anything unknown reads as not covered. */
const coverage = (tier: string) => copy.coverage[(tier in copy.coverage ? tier : "stub") as CoverageTier];

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
  let state: TripState;
  try {
    state = await store.state();
  } catch {
    notFound();
  }

  const { data: rows } = await db
    .from("chat_messages")
    .select("id, role, content, proposed_diff, diff_status, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: false })
    .limit(60);
  const messages: ChatMessage[] = (rows ?? []).reverse().map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    proposal: m.proposed_diff ? parseProposal(m.proposed_diff) : null,
    status: (m.diff_status as ChatMessage["status"]) ?? null,
  }));

  // Names for every city a proposal in the chat mentions, so an old day
  // proposal keeps its city after the route changes.
  const proposalCityIds = [...new Set(messages.flatMap((m) => m.proposal?.days.map((d) => d.cityId) ?? []))];
  const { data: cityRows } = proposalCityIds.length
    ? await db.from("cities").select("id, name").in("id", proposalCityIds)
    : { data: [] as { id: string; name: string }[] };
  const cityNames = Object.fromEntries([
    ...(cityRows ?? []).map((c) => [c.id, c.name] as const),
    ...state.cities.map((c) => [c.cityId, c.name] as const),
  ]);

  const requested = typeof sp.day === "string" ? sp.day : null;
  const { dayList, statsByDate, selected, selectedDay, selectedMeta, stats } = buildTripView(state, requested);

  // Each moving day's trains, from Bento's own train data. Worked out again
  // from the accepted route rather than stored, so it always matches it. A
  // failure here only leaves the trains off the page.
  const sortedCities = [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder);
  const travel = sortedCities.length > 1
    ? await Promise.all([store.cities(), store.graph()])
        .then(([facts, graph]) => {
          const a = assessRoute(sortedCities.map((c) => ({ cityId: c.cityId, nights: c.nights })), new Map(facts.map((f) => [f.id, f])), graph);
          return travelDays(sortedCities, a.legs);
        })
        .catch(() => null)
    : null;
  const nights = nightsBetween(state.trip.startDate, state.trip.endDate);
  const error = typeof sp.error === "string" ? sp.error : null;
  const today = new Date().toISOString().slice(0, 10);
  const gaps = await loadGaps(db, id, today).catch(() => null);
  // "How did the plan hold up?" once the trip has ended (0019). An answer
  // already given stays on the page, and changeable, whatever the trip does
  // after: it is about the plan saved with it.
  const { data: reviewRow } = await db.from("trip_reviews").select("outcome, challenges, hard_days, note, plan").eq("trip_id", id).maybeSingle();
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
  // For the Bookings column. Never the reference: it is decrypted only on
  // the vault page.
  const { data: bookingRows } = await db
    .from("bookings")
    .select("id, type, title, starts_at, ends_at, starts_time_known, ends_time_known, planned_on")
    .eq("trip_id", id);
  const bookings: PlanBooking[] = (bookingRows ?? []).map((b) => ({
    id: b.id, type: b.type, title: b.title, startsAt: b.starts_at, endsAt: b.ends_at, plannedOn: b.planned_on,
    startTimeKnown: b.starts_time_known !== false, endTimeKnown: b.ends_time_known !== false,
  }));
  // The companions' link, if the trip is shared (0020).
  const { data: share } = await db.from("trip_shares").select("token").eq("trip_id", id).maybeSingle();
  const shareUrl = share ? `${siteOrigin(await headers())}/shared/${share.token}` : null;
  // Changing or ending a link is quiet and asks first: whoever has it loses it.
  const quiet = "min-h-9 rounded-full px-3.5 text-[0.84rem] font-medium text-ink-2";
  const sharePanel = (
    <div className="tile flex flex-col gap-3 p-5">
      {shareUrl ? (
        <>
          <ShareLink url={shareUrl} title={state.trip.title ?? copy.trips.untitled} />
          <p className="text-[0.86rem] leading-relaxed text-ink-2">{copy.share.who}</p>
          <div className="flex flex-wrap gap-1 border-t border-rule pt-3">
            <form action={renewShareLink}>
              <input type="hidden" name="tripId" value={id} />
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
          <form action={shareTrip}>
            <input type="hidden" name="tripId" value={id} />
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

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-10">
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
          <header className="up" style={{ animationDelay: ".05s" }}>
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
              shared={Boolean(shareUrl)}
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
                      <div className="flex flex-col gap-1.5">
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
            >
              {/* On a phone the conversation sits below the whole plan. */}
              <a href="#bento-man" className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[0.88rem] font-medium text-on-accent hover:bg-accent-deep lg:hidden">
                {t.askBentoMan}
              </a>
            </TripActions>
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
            <nav aria-label={t.daysLabel} className="up mt-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" style={{ animationDelay: ".1s" }}>
              <ol className="flex w-max gap-2 pb-1">
                {dayList.map(([date, meta], i) => {
                  const s = statsByDate.get(date) ?? null;
                  const pct = s ? Math.min(100, Math.round((s.activeMin / s.budgetMin) * 100)) : 0;
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
            </nav>
          )}

          {selected && selectedMeta ? (
            <div className="mt-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h2 className="text-[1.5rem] font-bold">
                  {fmt(selected, { weekday: "long", day: "numeric", month: "long" })}
                  {/* One piece, so a narrow screen moves it down whole rather than splitting it. */}
                  <span className="mono ml-3 inline-block text-[0.72rem] font-normal text-ink-3">{selectedMeta.cityName} · {coverage(selectedMeta.tier)}</span>
                </h2>
                {stats && selectedDay && selectedDay.items.length > 0 && (
                  <span className="mono text-[0.72rem] text-ink-3">{t.dayStats(selectedDay.items.length, dur(stats.activeMin))}</span>
                )}
              </div>
              {travel?.get(selected) && (
                <section aria-label={t.travelDay.label} className="tile up mb-3 px-5 py-4">
                  <p className="mono text-[0.62rem] uppercase tracking-[0.1em] text-ink-3">{t.travelDay.label}</p>
                  <ul className="mt-2 flex flex-col gap-3">
                    {travel.get(selected)!.map((l) => (
                      <li key={`${l.fromCityId}-${l.toCityId}`}>
                        <p className="text-[0.95rem] font-medium leading-snug">{l.summary}</p>
                        {l.lines.map((line) => <p key={line} className="mono mt-1 text-[0.76rem] leading-snug text-ink-2">{line}</p>)}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <Link href={`/trips/${id}/vault`} className="text-[0.86rem] font-medium text-accent-ink hover:underline">{t.travelDay.tickets}</Link>
                    {travel.get(selected)!.some((l) => l.fareJpy != null && l.fareKind === "estimate") && (
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
                tier={coverage(selectedMeta.tier)}
                items={(selectedDay?.items ?? []).map((it) => ({
                  placeId: it.placeId, name: it.name, startMin: it.startMin, durationMin: it.durationMin, locked: it.locked,
                  reason: it.reason, reasonTerms: it.reasonTerms, arriveMode: it.arriveMode, arriveMinutes: it.arriveMinutes, arriveDetail: it.arriveDetail,
                }))}
                budgetMin={stats?.budgetMin ?? 480}
                activeMin={stats?.activeMin ?? 0}
                overBy={stats?.overBy ?? 0}
                overFromIndex={stats?.overFromIndex ?? null}
                lunch={stats?.lunch ?? null}
                editable={Boolean(selectedMeta.cityId) && selectedMeta.tier !== "stub"}
                uncovered={selectedMeta.tier === "stub"}
                bookings={bookings}
                tripDays={dayList.map(([d]) => d)}
              />
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

        <section id="bento-man" data-tour="chat" aria-label={copy.chat.name} className="tile up flex scroll-mt-4 bg-surface! h-[min(80dvh,720px)] flex-col overflow-hidden lg:sticky lg:top-6 lg:h-[calc(100dvh-8.5rem)] lg:min-h-[520px]" style={{ animationDelay: ".15s" }}>
          <Chat tripId={id} cityNames={cityNames} initial={messages} ask={ask} />
        </section>
      </div>
    </main>
  );
}
