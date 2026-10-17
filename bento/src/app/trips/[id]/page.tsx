import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tour } from "@/components/tour/tour";
import { tourSeen } from "@/components/tour/seen";
import { AppHeader } from "@/components/app-header";
import { DateRangeInputs, SubmitButton } from "@/components/form-controls";
import { fieldInput, fieldLabel } from "@/components/form-styles";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { parseProposal } from "@/lib/bento-man/diff";
import { nightsBetween, type TripState } from "@/lib/bento-man/store";
import { buildTripView } from "@/lib/bento-man/trip-view";
import { loadGaps } from "@/lib/vault/store";
import { ErrorNote } from "@/app/(auth)/ui";
import { updateTrip } from "../actions";
import { setDatePermission } from "./actions";
import { UseSeason } from "@/components/seasonal/background";
import { seasonOf } from "@/components/seasonal/season";
import { Chat, type ChatMessage } from "./chat";
import { DayBox } from "./day-box";
import type { PlanBooking } from "./bookings-column";
import { copy } from "@/copy";
import { AnalyticsUser } from "@/components/analytics/analytics";
import type { CoverageTier } from "@/lib/types";

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

  const nights = nightsBetween(state.trip.startDate, state.trip.endDate);
  const error = typeof sp.error === "string" ? sp.error : null;
  const gaps = await loadGaps(db, id, new Date().toISOString().slice(0, 10)).catch(() => null);
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
  const worst = gaps?.gaps[0] ?? null;

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
            <details data-tour="edit-trip" className="group mt-3 max-w-xl" open={!state.trip.startDate || !state.trip.endDate}>
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-rule px-4 text-[0.88rem] text-ink-2 hover:bg-sunk [&::-webkit-details-marker]:hidden">
                {state.trip.startDate && state.trip.endDate ? t.edit.open : t.edit.addDates}
                <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
              </summary>
              <form
                key={`${state.trip.title ?? ""}|${state.trip.startDate ?? ""}|${state.trip.endDate ?? ""}|${state.trip.partySize}`}
                action={updateTrip}
                className="tile mt-3 flex flex-col gap-4 p-5">
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
                <SubmitButton pending={copy.common.saving} className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-deep">{t.edit.save}</SubmitButton>
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
            </details>
            {/* On a phone the conversation sits below the whole plan. */}
            <a href="#bento-man" className="mt-2 flex w-fit min-h-10 items-center rounded-full bg-accent px-4 text-[0.88rem] font-medium text-white hover:bg-accent-deep lg:hidden">
              {t.askBentoMan}
            </a>
          </header>

          <div className="mt-4"><ErrorNote message={error} /></div>

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
              <span className="ml-auto text-[0.85rem] font-medium text-accent sm:ml-0">{t.bookingsBar.open}</span>
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
                        <span className="disp text-[0.95rem] font-bold leading-tight">{meta.cityName}</span>
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
                  <span className="mono ml-3 text-[0.72rem] font-normal text-ink-3">{selectedMeta.cityName} · {coverage(selectedMeta.tier)}</span>
                </h2>
                {stats && selectedDay && selectedDay.items.length > 0 && (
                  <span className="mono text-[0.72rem] text-ink-3">{t.dayStats(selectedDay.items.length, dur(stats.activeMin))}</span>
                )}
              </div>
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
          <Chat tripId={id} cityNames={cityNames} initial={messages} ask={typeof sp.ask === "string" ? sp.ask.slice(0, 500) : undefined} />
        </section>
      </div>
    </main>
  );
}
