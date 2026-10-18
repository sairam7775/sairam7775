import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupabaseStore } from "@/lib/bento-man/store.supabase";
import { nightsBetween, type TripState } from "@/lib/bento-man/store";
import { buildTripView } from "@/lib/bento-man/trip-view";
import type { PlaceInput } from "@/lib/engine/types";
import { planDocument, type DocBooking, type DocEntry } from "@/lib/trips/plan-document";
import { AnalyticsUser } from "@/components/analytics/analytics";
import { copy } from "@/copy";
import { PrintButton } from "./print-button";

const t = copy.print;
const bk = copy.bookings;
const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString(copy.locale, { ...opts, timeZone: "UTC" });
const longDate = (d: string) => fmt(d, { weekday: "short", day: "numeric", month: "short" });
const kind = (type: string) => (bk.kinds as Record<string, string>)[type] ?? bk.kinds.other;

/** The file name a browser gives the saved PDF comes from the title. */
export async function generateMetadata({ params }: PageProps<"/trips/[id]/print">): Promise<Metadata> {
  const { id } = await params;
  const db = await createClient();
  const { data } = await db.from("trips").select("title").eq("id", id).maybeSingle();
  return { title: { absolute: t.pageTitle(data?.title ?? copy.trips.untitled) }, robots: { index: false } };
}

/** The whole plan on one page, made to be printed or saved as a PDF and
 *  carried offline: the route, every day with its bookings and stops (how
 *  to get there, the station, opening hours, the tip), and the bookings
 *  list. Accepted state only, as on the trip page. Never a booking
 *  reference: this leaves Bento. */
export default async function PrintPlan({ params }: PageProps<"/trips/[id]/print">) {
  const { id } = await params;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect(`/sign-in?next=/trips/${id}/print`);

  const store = new SupabaseStore(db, id, user.id);
  let state: TripState;
  try {
    state = await store.state();
  } catch {
    notFound();
  }

  const { dayList } = buildTripView(state, null);
  const cityIds = [...new Set(state.days.map((d) => d.cityId).filter((c): c is string => Boolean(c)))];
  const [placeLists, graph, { data: bookingRows }] = await Promise.all([
    Promise.all(cityIds.map((c) => store.places(c).catch(() => [] as PlaceInput[]))),
    store.graph(),
    // Never the reference.
    db.from("bookings").select("id, type, title, starts_at, ends_at, starts_time_known, ends_time_known, planned_on").eq("trip_id", id),
  ]);
  const places = new Map(placeLists.flat().map((p) => [p.id, p]));
  const bookings: DocBooking[] = (bookingRows ?? []).map((b) => ({
    id: b.id, type: b.type, title: b.title, startsAt: b.starts_at, endsAt: b.ends_at, plannedOn: b.planned_on,
    startTimeKnown: b.starts_time_known !== false, endTimeKnown: b.ends_time_known !== false,
  }));
  const doc = planDocument(state, dayList, bookings, places, graph.stations);

  const { trip } = state;
  const nights = nightsBetween(trip.startDate, trip.endDate);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12 print:max-w-none print:p-0">
      <AnalyticsUser id={user.id} />
      <div className="tile mb-8 flex flex-wrap items-center gap-x-4 gap-y-3 p-4 print:hidden">
        <Link href={`/trips/${id}`} className="min-h-10 content-center rounded-full border border-rule px-4 text-[0.88rem] text-ink-2 hover:bg-sunk">
          {t.back}
        </Link>
        <PrintButton days={doc.days.length} bookings={doc.bookings.length} />
        <p className="basis-full text-[0.86rem] text-ink-2">{t.howTo}</p>
      </div>

      <article className="text-ink">
        <header className="border-b-2 border-ink pb-4">
          <h1 className="text-[2rem] font-extrabold leading-tight">{trip.title ?? copy.trips.untitled}</h1>
          <p className="mono mt-1.5 text-[0.85rem] text-ink-2">
            {trip.startDate && trip.endDate
              ? copy.trip.dateRange(fmt(trip.startDate, { day: "numeric", month: "short", year: "numeric" }), fmt(trip.endDate, { day: "numeric", month: "short", year: "numeric" }), nights ?? 0)
              : copy.trips.noDates}
            {trip.partySize > 1 && ` · ${t.people(trip.partySize)}`}
          </p>
          <p className="mt-1 text-[0.8rem] text-ink-3">{t.saved(fmt(today, { day: "numeric", month: "long", year: "numeric" }))}</p>
        </header>

        <section className="mt-6 break-inside-avoid">
          <h2 className="text-[1.15rem] font-bold">{t.route}</h2>
          {doc.route.length ? (
            <p className="mt-1.5 text-[0.95rem]">{doc.route.map((c) => (c.nights ? copy.trip.cityNights(c.city, c.nights) : copy.trip.cityDayTrip(c.city))).join(copy.trip.routeJoin)}</p>
          ) : (
            <p className="mt-1.5 text-[0.95rem] text-ink-2">{copy.trip.noRoute}</p>
          )}
        </section>

        {doc.days.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[1.15rem] font-bold">{t.days}</h2>
            {doc.days.map((d) => (
              <div key={d.date} className="mt-5">
                <h3 className="break-after-avoid border-b border-rule pb-1.5 text-[1rem] font-bold">{t.day(d.number, longDate(d.date), d.city)}</h3>
                {d.entries.length ? (
                  <ol className="mt-2 flex flex-col gap-3">
                    {d.entries.map((e, i) => <Entry key={i} e={e} />)}
                  </ol>
                ) : (
                  <p className="mt-2 text-[0.9rem] text-ink-3">{t.nothingPlanned}</p>
                )}
              </div>
            ))}
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-[1.15rem] font-bold">{t.bookings}</h2>
          {doc.bookings.length ? (
            <ul className="mt-2 flex flex-col">
              {doc.bookings.map((b, i) => (
                <li key={i} className="flex break-inside-avoid flex-wrap items-baseline gap-x-3 border-b border-rule py-2 text-[0.92rem]">
                  <span className="mono w-24 shrink-0 text-[0.72rem] uppercase tracking-[0.08em] text-ink-3">{kind(b.type)}</span>
                  <span className="flex-1 font-medium">{b.title}</span>
                  <span className="mono text-[0.8rem] text-ink-2">
                    {b.first ? (b.first === b.last ? longDate(b.first) : bk.range(longDate(b.first), longDate(b.last!))) : t.noDate}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[0.9rem] text-ink-2">{t.noBookings}</p>
          )}
          <p className="mt-3 text-[0.82rem] text-ink-3">{t.referencesNote}</p>
        </section>
      </article>
    </main>
  );
}

function Entry({ e }: { e: DocEntry }) {
  if (e.kind === "booking") {
    const stay = e.type === "accommodation";
    const note = e.part === "ends" ? (stay ? bk.checkOut : bk.ends) : e.part === "all-day" ? (stay ? bk.staying : bk.allDay) : stay ? bk.checkIn : null;
    return (
      <li className="flex break-inside-avoid gap-4">
        <span className="mono w-12 shrink-0 pt-0.5 text-[0.82rem] text-ink-2">{e.time ?? "—"}</span>
        <div className="flex-1 border-l-2 border-ink pl-3">
          <p className="mono text-[0.66rem] uppercase tracking-[0.1em] text-ink-3">{kind(e.type)} · {note ?? t.booking}</p>
          <p className="text-[0.95rem] font-medium">{e.title}</p>
          {e.time == null && e.part !== "all-day" && <p className="text-[0.82rem] text-ink-3">{bk.timeNotGiven}</p>}
        </div>
      </li>
    );
  }
  const facts = [
    e.station ? t.station(e.station, e.stationWalkMin) : null,
    e.hours ? t.hours(e.hours.opens, e.hours.closes) : null,
  ].filter(Boolean);
  return (
    <li className="flex break-inside-avoid gap-4">
      <span className="mono w-12 shrink-0 pt-0.5 text-[0.82rem] text-ink-2">{e.time ?? "--:--"}</span>
      <div className="flex-1 pl-3.5">
        {e.getThere && (
          <p className="mono mb-1 text-[0.74rem] text-ink-3">
            {t.getThere(e.getThere)}{e.getThereMin != null && ` · ${copy.time.minutes(e.getThereMin)}`}
          </p>
        )}
        <p className="text-[0.98rem] font-bold">
          {e.name}
          {e.durationMin != null && <span className="mono ml-2 text-[0.76rem] font-normal text-ink-3">{copy.time.duration(e.durationMin)}{e.end ? ` · ${e.time}–${e.end}` : ""}</span>}
        </p>
        {facts.length > 0 && <p className="mt-0.5 text-[0.84rem] text-ink-2">{facts.join(" · ")}</p>}
        {e.crowdNote && <p className="mt-0.5 text-[0.84rem] text-ink-2">{e.crowdNote}</p>}
        {e.tip && <p className="mt-0.5 text-[0.84rem] text-ink-2">{e.tip}</p>}
        {e.why && <p className="mt-0.5 text-[0.8rem] text-ink-3">{t.why(e.why)}</p>}
      </div>
    </li>
  );
}
