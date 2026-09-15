import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BentoLogo } from "@/components/logo";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { parseProposal } from "@/lib/bento-man/diff";
import { nightsBetween, type TripState } from "@/lib/bento-man/store";
import { dayStats } from "@/lib/engine/day-stats";
import { allocateDates } from "@/lib/engine/route";
import { ErrorNote } from "@/app/(auth)/ui";
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

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="up flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex" aria-label="Bento home"><BentoLogo /></Link>
        <div className="flex flex-wrap gap-2">
          {state.trip.startDate && state.trip.endDate && (
            <span className="mono rounded-full bg-lacquer px-3 py-1.5 text-[0.72rem] text-rice">
              {fmt(state.trip.startDate, { day: "numeric", month: "short" })} – {fmt(state.trip.endDate, { day: "numeric", month: "short" })} · {nights} night{nights === 1 ? "" : "s"}
            </span>
          )}
          <Link href="/trips" className="mono rounded-full bg-surface px-3 py-1.5 text-[0.72rem] text-ink-2 shadow-[0_1px_2px_rgba(34,28,30,.06)]">← Your trips</Link>
        </div>
      </div>

      <header className="up mt-7" style={{ animationDelay: ".05s" }}>
        <h1 className="text-[2.4rem] font-extrabold leading-none sm:text-[3rem]">{state.trip.title ?? "Untitled trip"}</h1>
        <p className="mt-2.5 max-w-[60ch] text-[0.98rem] leading-relaxed text-ink-2">
          {state.cities.length
            ? `${state.cities.map((c) => (c.nights ? `${c.name} ${c.nights}n` : `${c.name} day trip`)).join(" → ")}.`
            : "No route yet. Tell Bento Man the dates and what kind of trip this is."}
          {state.trip.partySize > 1 && ` ${state.trip.partySize} travelling.`}
          {state.prefs.set && ` ${state.prefs.pace[0].toUpperCase()}${state.prefs.pace.slice(1)} pace.`}
        </p>
      </header>

      <div className="mt-4"><ErrorNote message={error} /></div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <section aria-label="The plan" className="min-w-0">
          {dayList.length > 0 && (
            <nav aria-label="Days" className="up -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" style={{ animationDelay: ".1s" }}>
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

        <section aria-label="Bento Man" className="tile up p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]" style={{ animationDelay: ".15s" }}>
          <Chat tripId={id} initial={messages} />
        </section>
      </div>
    </main>
  );
}
