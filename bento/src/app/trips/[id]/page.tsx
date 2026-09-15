import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BentoLogo } from "@/components/logo";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { clock, parseProposal } from "@/lib/bento-man/diff";
import { nightsBetween, type TripState } from "@/lib/bento-man/store";
import { ErrorNote } from "@/app/(auth)/ui";
import { Chat, type ChatMessage } from "./chat";

const fmtDate = (d: string, weekday = true) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: weekday ? "short" : undefined, day: "numeric", month: "short", timeZone: "UTC" });

/** The trip: its shape on the left, Bento Man on the right. The left side
 *  is the accepted state only — proposals live in the conversation until
 *  the traveller says yes (§08). */
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

  const nights = nightsBetween(state.trip.startDate, state.trip.endDate);
  const error = typeof sp.error === "string" ? sp.error : null;

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link href="/" className="inline-flex" aria-label="Bento home"><BentoLogo /></Link>
        <Link href="/trips" className="mono text-[0.7rem] uppercase tracking-[0.14em] text-ink-3">← Your trips</Link>
      </div>

      <header className="mt-8">
        <h1 className="text-3xl font-bold tracking-tight">{state.trip.title ?? "Untitled trip"}</h1>
        <p className="mono mt-1.5 text-[0.78rem] text-ink-3">
          {state.trip.startDate && state.trip.endDate
            ? `${fmtDate(state.trip.startDate, false)} – ${fmtDate(state.trip.endDate, false)} · ${nights} night${nights === 1 ? "" : "s"}`
            : "No dates yet"}
          {state.trip.partySize > 1 && ` · ${state.trip.partySize} people`}
          {state.prefs.set && ` · ${state.prefs.pace} pace`}
        </p>
      </header>

      <div className="mt-4"><ErrorNote message={error} /></div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label="The plan" className="flex flex-col gap-6">
          <div className="rounded-2xl border border-rule bg-surface p-5">
            <h2 className="mono text-[0.66rem] uppercase tracking-[0.12em] text-ink-3">Route</h2>
            {state.cities.length ? (
              <ol className="mt-3 flex flex-col gap-2.5">
                {state.cities.map((c, i) => (
                  <li key={c.cityId} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="mono text-[0.72rem] text-ink-3">{i + 1}.</span>
                    <span className="font-medium">{c.name}</span>
                    <span className="mono text-[0.7rem] text-ink-3">
                      {c.nights ? `${c.nights} night${c.nights === 1 ? "" : "s"}` : "day trip"} · {c.tier}
                      {c.arriveDate ? ` · ${fmtDate(c.arriveDate)}` : ""}
                    </span>
                    {c.reason && <span className="basis-full text-[0.85rem] text-ink-2">{c.reason}</span>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-[0.9rem] text-ink-2">No route yet. Ask Bento Man where to go, or tell him.</p>
            )}
          </div>

          <div className="rounded-2xl border border-rule bg-surface p-5">
            <h2 className="mono text-[0.66rem] uppercase tracking-[0.12em] text-ink-3">Days</h2>
            {state.days.length ? (
              <div className="mt-3 flex flex-col gap-5">
                {state.days.map((d) => (
                  <div key={d.date}>
                    <p className="font-display text-[0.95rem] font-bold">
                      {fmtDate(d.date)} <span className="mono text-[0.68rem] font-normal text-ink-3">{d.cityId}</span>
                    </p>
                    {d.items.length ? (
                      <ol className="mt-2 flex flex-col gap-2">
                        {d.items.map((it) => (
                          <li key={it.placeId} className="grid grid-cols-[3.4rem_1fr] gap-x-3 text-[0.9rem]">
                            <span className="mono pt-0.5 text-[0.72rem] text-ink-3">{it.startMin != null ? clock(it.startMin) : "--:--"}</span>
                            <div>
                              <span className="font-medium">{it.name}</span>
                              {it.locked && <span className="mono ml-2 text-[0.6rem] uppercase tracking-[0.1em] text-indigo">pinned</span>}
                              {it.reason && <p className="text-[0.82rem] leading-snug text-ink-2">{it.reason}</p>}
                              {it.arriveDetail && <p className="mono mt-0.5 text-[0.66rem] text-ink-3">↳ {it.arriveDetail}</p>}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mt-1 text-[0.85rem] text-ink-3">Nothing planned yet.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[0.9rem] text-ink-2">No days planned. Once the route is accepted, ask Bento Man to plan the days.</p>
            )}
          </div>
        </section>

        <section aria-label="Bento Man" className="rounded-2xl border border-rule bg-surface p-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
          <Chat tripId={id} initial={messages} />
        </section>
      </div>
    </main>
  );
}
