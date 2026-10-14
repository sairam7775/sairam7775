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
import { dayStats } from "@/lib/engine/day-stats";
import { loadGaps } from "@/lib/vault/store";
import { allocateDates } from "@/lib/engine/route";
import { ErrorNote } from "@/app/(auth)/ui";
import { updateTrip } from "../actions";
import { UseSeason } from "@/components/seasonal/background";
import { seasonOf } from "@/components/seasonal/season";
import { Chat, type ChatMessage } from "./chat";
import { DayBox } from "./day-box";

const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
const dur = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}` : `${m}m`);

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

  // Every date of the trip, from the accepted route, whether or not it has a plan yet.
  const cityById = new Map(state.cities.map((c) => [c.cityId, c]));
  const dates = new Map<string, { cityId: string | null; cityName: string; tier: string }>();
  for (const c of allocateDates(state.trip.startDate, [...state.cities].sort((a, b) => a.sortOrder - b.sortOrder), state.trip.endDate)) {
    for (const d of c.dates) dates.set(d, { cityId: c.cityId, cityName: cityById.get(c.cityId)?.name ?? c.cityId, tier: cityById.get(c.cityId)?.tier ?? "stub" });
  }
  for (const d of state.days) {
    const c = d.cityId ? cityById.get(d.cityId) : null;
    dates.set(d.date, { cityId: d.cityId, cityName: c?.name ?? d.cityId ?? "—", tier: c?.tier ?? "stub" });
  }
  const dayList = [...dates.entries()].sort(([a], [b]) => a.localeCompare(b));
  const daysByDate = new Map(state.days.map((d) => [d.date, d]));
  const requested = typeof sp.day === "string" ? sp.day : null;
  const selected = requested && dates.has(requested) ? requested : dayList[0]?.[0] ?? null;
  const selectedDay = selected ? daysByDate.get(selected) : undefined;
  const selectedMeta = selected ? dates.get(selected)! : null;
  const stats = selectedDay ? dayStats(selectedDay.items, state.prefs.pace) : null;

  const nights = nightsBetween(state.trip.startDate, state.trip.endDate);
  const error = typeof sp.error === "string" ? sp.error : null;
  const gaps = await loadGaps(db, id, new Date().toISOString().slice(0, 10)).catch(() => null);
  const worst = gaps?.gaps[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-[1680px] px-4 py-6 sm:px-6 lg:px-10">
      {state.trip.startDate && <UseSeason season={seasonOf(state.trip.startDate)} />}
      <AppHeader back={{ href: "/trips", label: "Your trips" }}>
        <Tour id="trip" seen={await tourSeen("trip")} />
        {state.trip.startDate && state.trip.endDate && (
          <span className="mono rounded-full bg-lacquer px-3 py-1.5 text-[0.78rem] text-rice">
            {fmt(state.trip.startDate, { day: "numeric", month: "short" })} – {fmt(state.trip.endDate, { day: "numeric", month: "short" })} · {nights} night{nights === 1 ? "" : "s"}
          </span>
        )}
      </AppHeader>

      <div className="mt-6 grid lg:items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,34%)]">
        <section aria-label="The plan" className="min-w-0">
          <header className="up" style={{ animationDelay: ".05s" }}>
            <h1 className="text-[2.4rem] font-extrabold leading-none sm:text-[3rem]">{state.trip.title ?? "Untitled trip"}</h1>
            <p className="mt-2.5 max-w-[60ch] text-[0.98rem] leading-relaxed text-ink-2">
              {state.cities.length
                ? `${state.cities.map((c) => (c.nights ? `${c.name} ${c.nights}n` : `${c.name} day trip`)).join(" → ")}.`
                : "No route yet. Tell Bento Man the dates and what kind of trip this is."}
              {state.trip.partySize > 1 && ` ${state.trip.partySize} travelling.`}
              {state.prefs.set && ` ${state.prefs.pace[0].toUpperCase()}${state.prefs.pace.slice(1)} pace.`}
            </p>
            <details data-tour="edit-trip" className="group mt-3 max-w-xl" open={!state.trip.startDate || !state.trip.endDate}>
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-full border border-rule px-4 text-[0.88rem] text-ink-2 hover:bg-sunk [&::-webkit-details-marker]:hidden">
                {state.trip.startDate && state.trip.endDate ? "Edit trip" : "Add dates"}
                <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
              </summary>
              <form
                key={`${state.trip.title ?? ""}|${state.trip.startDate ?? ""}|${state.trip.endDate ?? ""}|${state.trip.partySize}`}
                action={updateTrip}
                className="tile mt-3 flex flex-col gap-4 p-5">
                <input type="hidden" name="id" value={id} />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="title" className={fieldLabel}>Trip name</label>
                  <input id="title" name="title" defaultValue={state.trip.title ?? ""} placeholder="Kansai, autumn" className={fieldInput} />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <DateRangeInputs startLabel="Arrive in Japan" endLabel="Leave Japan" defaultStart={state.trip.startDate} defaultEnd={state.trip.endDate} labelClass={fieldLabel} inputClass={fieldInput} />
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="partySize" className={fieldLabel}>People travelling</label>
                    <input id="partySize" name="partySize" type="number" min={1} max={20} defaultValue={state.trip.partySize} className={fieldInput} />
                  </div>
                </div>
                {state.cities.length > 0 && (
                  <p className="text-[0.84rem] text-ink-3">Changing dates moves your route and your planned days with it. Day plans still waiting for an answer in the chat are closed, since they were made for the old dates. The new dates need room for every night of the route.</p>
                )}
                <SubmitButton pending="Saving…" className="self-start rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-deep">Save</SubmitButton>
              </form>
            </details>
            {/* On a phone the conversation sits below the whole plan. */}
            <a href="#bento-man" className="mt-2 flex w-fit min-h-10 items-center rounded-full bg-accent px-4 text-[0.88rem] font-medium text-white hover:bg-accent-deep lg:hidden">
              Ask Bento Man ↓
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
                {gaps.blocking ? `${gaps.blocking} blocking` : "Bookings"}
              </span>
              <span className="order-last min-w-0 basis-full text-[0.9rem] leading-snug sm:order-none sm:basis-auto sm:flex-1">
                {worst ? worst.title : gaps.totalNights > 0 ? `Every night has a bed. ${gaps.coveredNights} of ${gaps.totalNights} covered.` : "Flights, hotels and tickets — keep them here, and see what’s still missing once the trip has dates."}
              </span>
              {gaps.totalNights > 0 && (
                <span aria-hidden className="flex shrink-0 gap-[3px]">
                  {gaps.nights.map((n) => (
                    <span key={n.date} className={`h-4 w-1.5 rounded-full ${n.covered ? "bg-edamame" : "bg-ume"}`} />
                  ))}
                </span>
              )}
              <span className="ml-auto text-[0.85rem] font-medium text-accent sm:ml-0">Bookings →</span>
            </Link>
          )}

          {dayList.length > 0 && (
            <nav aria-label="Days" className="up mt-5 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" style={{ animationDelay: ".1s" }}>
              <ol className="flex w-max gap-2 pb-1">
                {dayList.map(([date, meta], i) => {
                  const day = daysByDate.get(date);
                  const s = day ? dayStats(day.items, state.prefs.pace) : null;
                  const pct = s ? Math.min(100, Math.round((s.activeMin / s.budgetMin) * 100)) : 0;
                  const active = date === selected;
                  return (
                    <li key={date}>
                      <Link
                        href={`/trips/${id}?day=${date}`}
                        aria-current={active ? "page" : undefined}
                        className={`lift flex w-[7.2rem] flex-col gap-1.5 rounded-tile px-3 py-2.5 shadow-tile ${active ? "bg-lacquer text-rice" : "bg-surface text-ink"}`}
                      >
                        <span className="mono text-[0.62rem] uppercase tracking-[0.1em] opacity-70">Day {i + 1} · {fmt(date, { weekday: "short" })}</span>
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
                  <span className="mono ml-3 text-[0.72rem] font-normal text-ink-3">{selectedMeta.cityName} · {selectedMeta.tier}</span>
                </h2>
                {stats && selectedDay && selectedDay.items.length > 0 && (
                  <span className="mono text-[0.72rem] text-ink-3">{selectedDay.items.length} stops · {dur(stats.activeMin)} active</span>
                )}
              </div>
              <DayBox
                key={selected}
                tripId={id}
                date={selected}
                cityId={selectedMeta.cityId ?? ""}
                cityName={selectedMeta.cityName}
                tier={selectedMeta.tier}
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
              />
            </div>
          ) : (
            <div className="box up mt-4 p-3">
              <div className="tile px-6 py-10 text-center">
                <p className="disp text-[1.2rem] font-bold">An empty box.</p>
                <p className="mx-auto mt-2 max-w-[38ch] text-[0.92rem] text-ink-2">
                  Give Bento Man the dates and a route and each day gets a compartment here, sized to the time it takes.
                </p>
              </div>
            </div>
          )}
        </section>

        <section id="bento-man" data-tour="chat" aria-label="Bento Man" className="tile up flex scroll-mt-4 h-[min(80dvh,720px)] flex-col overflow-hidden lg:sticky lg:top-6 lg:h-[calc(100dvh-8.5rem)] lg:min-h-[520px]" style={{ animationDelay: ".15s" }}>
          <Chat tripId={id} initial={messages} ask={typeof sp.ask === "string" ? sp.ask.slice(0, 500) : undefined} />
        </section>
      </div>
    </main>
  );
}
